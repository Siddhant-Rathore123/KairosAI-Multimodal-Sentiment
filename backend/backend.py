from sqlalchemy import create_engine, MetaData, Table, Column, Integer, String

DATABASE_URL = "sqlite:///./files.db"

engine = create_engine(DATABASE_URL)
metadata = MetaData()

files_table = Table(
    "files",
    metadata,
    Column("id", Integer, primary_key=True, index=True),
    Column("filename", String),
    Column("filepath", String)
)

metadata.create_all(engine)
