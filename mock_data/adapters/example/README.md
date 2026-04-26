# AdapterFromApi FastAPI Example

This directory contains a runnable FastAPI/Pydantic API that implements the Command Center
`AdapterFromApi` provider-side contract described in
`docs/adr/adr-adapter-from-api-connection.md`.

It is a mock upstream API. The browser should not call it directly in the real connection flow.
Command Center should configure an `AdapterFromApi` connection with the API root URL, then the
backend adapter should fetch the well-known contract, store credentials, call the API operations,
and pass the upstream responses back through the connection route.

## Entry Points

- `app.py`: FastAPI app, Pydantic contract models, well-known contract endpoint, dedicated health
  endpoint, and graph data endpoints.
- `requirements.txt`: minimal runtime dependencies for the example.

## Contract Endpoints

- `GET /.well-known/command-center/connection-contract`: returns the Command Center adapter
  contract. This is the required discovery endpoint.
- `GET /openapi.json`: normal FastAPI OpenAPI document. It is supplementary only and not the
  adapter discovery contract.

## Health Endpoint

- `GET /health`: returns `{ "ok": true, "status": "ok" }`.

The well-known contract points its `health.operationId` at this route. It does not use a
parameterized business query as a fake health probe.

## Query Operations

- `GET /graph-line?slope=1.25`: returns exactly 100 `{ x, y }` points where `y = slope * x`.
- `GET /graph-random-walk?std=2`: returns exactly 100 `{ x, y }` points from a Gaussian random
  walk with the requested standard deviation.

Both operations declare a `core.tabular_frame@v1` response mapping using `$.points` as the rows
path.

## Dynamic Config And Secrets

The contract includes dynamic public config fields for string, number, boolean, select, and JSON
inputs so the frontend config editor can render each supported type.

The contract also includes an optional `apiToken` secret variable. It declares backend-only bearer
token injection into the `Authorization` header. The mock endpoints do not require the token so the
example stays easy to run locally, but a real backend adapter must store, inject, and redact it.

## Run Locally

```bash
cd mock_data/adapters/example
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.txt
uvicorn app:app --reload --port 8010
```

If you use VS Code launch directly with a Python interpreter that is different from the one where
`uvicorn` is installed, the launch will fail with `No module named uvicorn`. The launch config now
uses a preLaunch task to install dependencies into your selected interpreter path.

This repo now hard-pins the mock adapter launch/debug session to:

`/Users/jose/mainsequence-dev/main-sequence-workbench/projects/hope-30-81/.venv/bin/python`

## Run with Docker

```bash
cd mock_data/adapters/example
docker build -t command-center-adapter-mock:latest .
docker run --rm -p 8010:8010 command-center-adapter-mock:latest
```

Once running:

```bash
curl http://127.0.0.1:8010/.well-known/command-center/connection-contract
```

## VS Code Launch Configuration

Useful checks:

```bash
curl http://127.0.0.1:8010/.well-known/command-center/connection-contract
curl "http://127.0.0.1:8010/graph-line?slope=1.5"
curl "http://127.0.0.1:8010/graph-random-walk?std=0.75"
```

Use this API root URL when creating an `AdapterFromApi` connection:

```text
http://127.0.0.1:8010
```

An auto-run debug configuration was added at:

- `.vscode/launch.json`
- **Mock Adapter Example (FastAPI)**

This uses `uvicorn app:app --host 0.0.0.0 --port 8010` with the working directory set to
`mock_data/adapters/example`, so you can run and test the adapter quickly from VS Code.

## Maintenance Constraints

- Keep `/health` zero-argument and trivial. Do not turn it into a parameterized business endpoint.
- Keep operation ids stable: `graphLine` and `graphRandomWalk`.
- Keep response rows under `points` unless the response mapping is changed at the same time.
- Keep the business operations read-only. Mutating operations are intentionally not represented in
  this first example.
- Do not add real secrets or provider tokens to this directory.
