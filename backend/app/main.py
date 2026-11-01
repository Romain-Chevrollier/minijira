from fastapi import FastAPI

app = FastAPI(title="MiniJira")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
