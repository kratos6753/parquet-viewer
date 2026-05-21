import io
import json
import math
import time
import uuid
from pathlib import Path

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

app = FastAPI(title="Parquet Viewer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path("/tmp/parquet_viewer")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MAX_FILE_SIZE = 200 * 1024 * 1024  # 200 MB

_table_cache: dict[str, pa.Table] = {}


@app.on_event("startup")
async def cleanup_old_files():
    now = time.time()
    for f in UPLOAD_DIR.glob("*.parquet"):
        if now - f.stat().st_mtime > 86400:  # 24 hours
            f.unlink(missing_ok=True)
            _table_cache.pop(f.stem, None)


def _get_table(file_id: str) -> pa.Table:
    if file_id in _table_cache:
        return _table_cache[file_id]
    file_path = UPLOAD_DIR / f"{file_id}.parquet"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found or expired")
    table = pq.read_table(file_path)
    _table_cache[file_id] = table
    return table


def _df_to_records(df: pd.DataFrame) -> list:
    json_str = df.to_json(orient="records", date_format="iso", default_handler=str)
    return json.loads(json_str)


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    if not (file.filename or "").lower().endswith(".parquet"):
        raise HTTPException(status_code=400, detail="Only .parquet files are supported")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds the 200 MB limit")

    file_id = str(uuid.uuid4())
    file_path = UPLOAD_DIR / f"{file_id}.parquet"

    try:
        file_path.write_bytes(content)
        table = pq.read_table(file_path)
        _table_cache[file_id] = table
    except Exception as exc:
        file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail=f"Invalid parquet file: {exc}") from exc

    columns = [{"name": field.name, "type": str(field.type)} for field in table.schema]

    return {
        "file_id": file_id,
        "filename": file.filename,
        "row_count": len(table),
        "col_count": len(columns),
        "columns": columns,
    }


@app.get("/api/data/{file_id}")
async def get_data(
    file_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=1000),
):
    table = _get_table(file_id)
    total_rows = len(table)
    total_pages = max(1, math.ceil(total_rows / page_size))
    page = min(page, total_pages)

    start = (page - 1) * page_size
    length = min(page_size, total_rows - start)
    slice_table = table.slice(start, length)
    df = slice_table.to_pandas()
    records = _df_to_records(df)

    return {
        "data": records,
        "page": page,
        "page_size": page_size,
        "total_rows": total_rows,
        "total_pages": total_pages,
        "start_row": start + 1,
        "end_row": start + length,
    }


@app.get("/api/download/{file_id}")
async def download_data(
    file_id: str,
    scope: str = Query("all", pattern="^(page|all)$"),
    format: str = Query("csv", pattern="^(csv|parquet)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=1000),
):
    table = _get_table(file_id)

    if scope == "page":
        total_rows = len(table)
        start = (page - 1) * page_size
        length = min(page_size, total_rows - start)
        table = table.slice(start, length)

    filename_stem = f"data_{scope}"

    if format == "csv":
        df = table.to_pandas()
        buf = io.StringIO()
        df.to_csv(buf, index=False)
        data = buf.getvalue().encode("utf-8")
        return StreamingResponse(
            iter([data]),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename_stem}.csv"'},
        )

    buf = io.BytesIO()
    pq.write_table(table, buf)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.read()]),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename_stem}.parquet"'},
    )
