from __future__ import annotations

import random
from datetime import UTC, datetime
from typing import Any, Literal

from fastapi import FastAPI, Query, Request
from pydantic import BaseModel, ConfigDict, Field


class ContractModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class FieldOption(ContractModel):
    label: str
    value: str


class ValidationRule(ContractModel):
    pattern: str | None = None
    min: float | None = None
    max: float | None = None
    min_length: int | None = Field(default=None, alias="minLength")
    max_length: int | None = Field(default=None, alias="maxLength")


class VariableDefinition(ContractModel):
    key: str
    label: str
    description: str | None = None
    type: Literal["string", "number", "boolean", "select", "json", "secret"]
    required: bool = False
    default_value: Any = Field(default=None, alias="defaultValue")
    example: Any = None
    render_as: str | None = Field(default=None, alias="renderAs")
    options: list[FieldOption] | None = None
    validation: ValidationRule | None = None


class InjectionRule(ContractModel):
    type: Literal["header", "query", "basic", "bearer"]
    name: str | None = None
    template: str | None = None


class SecretVariableDefinition(VariableDefinition):
    type: Literal["secret"] = "secret"
    injection: InjectionRule | None = None


class OpenApiReference(ContractModel):
    url: str
    version: str = "3.1.0"
    checksum: str | None = None


class AdapterInfo(ContractModel):
    type: Literal["adapter-from-api"] = "adapter-from-api"
    id: str
    title: str
    description: str


class OperationParameters(ContractModel):
    path: list[VariableDefinition] = Field(default_factory=list)
    query: list[VariableDefinition] = Field(default_factory=list)
    headers: list[VariableDefinition] = Field(default_factory=list)


class RequestBodyDefinition(ContractModel):
    required: bool = False
    content_type: str = Field(default="application/json", alias="contentType")
    schema_: dict[str, Any] = Field(default_factory=dict, alias="schema")
    description: str | None = None


class ResponseMapping(ContractModel):
    id: str
    label: str
    contract: str
    status_code: str = Field(default="200", alias="statusCode")
    content_type: str = Field(default="application/json", alias="contentType")
    rows_path: str = Field(default="$.points", alias="rowsPath")
    field_types: dict[str, Literal["time", "number", "boolean", "string", "json"]] = Field(
        default_factory=dict,
        alias="fieldTypes",
    )
    time_series: dict[str, Any] | None = Field(default=None, alias="timeSeries")


class CachePolicy(ContractModel):
    policy: Literal["safe", "disabled"] = "safe"
    ttl_ms: int = Field(default=300_000, alias="ttlMs")
    dedupe_in_flight: bool = Field(default=True, alias="dedupeInFlight")


class OperationDefinition(ContractModel):
    operation_id: str = Field(alias="operationId")
    label: str
    description: str
    method: Literal["GET", "POST", "PUT", "PATCH", "DELETE"]
    path: str
    kind: Literal["query", "resource", "mutation"] = "query"
    capabilities: list[Literal["query", "resource", "mutation"]] = Field(
        default_factory=lambda: ["query"],
    )
    requires_time_range: bool = Field(default=False, alias="requiresTimeRange")
    supports_variables: bool = Field(default=True, alias="supportsVariables")
    supports_max_rows: bool = Field(default=False, alias="supportsMaxRows")
    parameters: OperationParameters = Field(default_factory=OperationParameters)
    request_body: RequestBodyDefinition | None = Field(default=None, alias="requestBody")
    response_mappings: list[ResponseMapping] = Field(
        default_factory=list,
        alias="responseMappings",
    )
    cache: CachePolicy = Field(default_factory=CachePolicy)


class HealthContract(ContractModel):
    operation_id: str = Field(alias="operationId")
    expected_status: int = Field(default=200, alias="expectedStatus")
    timeout_ms: int = Field(default=5_000, alias="timeoutMs")


class ConnectionContract(ContractModel):
    contract_version: int = Field(alias="contractVersion")
    adapter: AdapterInfo
    openapi: OpenApiReference
    config_variables: list[VariableDefinition] = Field(alias="configVariables")
    secret_variables: list[SecretVariableDefinition] = Field(alias="secretVariables")
    available_operations: list[OperationDefinition] = Field(alias="availableOperations")
    health: HealthContract


class GraphPoint(BaseModel):
    x: int
    y: float


class GraphSeriesResponse(BaseModel):
    operation_id: str = Field(alias="operationId")
    label: str
    points: list[GraphPoint]
    metadata: dict[str, Any]

    model_config = ConfigDict(populate_by_name=True)


class HealthResponse(BaseModel):
    ok: bool
    status: Literal["ok"]

    model_config = ConfigDict(populate_by_name=True)


POINTS_RESPONSE_MAPPING = ResponseMapping(
    id="points_table",
    label="Graph points table",
    contract="core.tabular_frame@v1",
    rowsPath="$.points",
    fieldTypes={"x": "number", "y": "number"},
    timeSeries={
        "xField": "x",
        "yField": "y",
        "seriesKind": "line",
    },
)

GRAPH_LINE_OPERATION = OperationDefinition(
    operationId="graphLine",
    label="Graph line",
    description="Returns 100 points for y = slope * x.",
    method="GET",
    path="/graph-line",
    parameters=OperationParameters(
        query=[
            VariableDefinition(
                key="slope",
                label="Slope",
                description="Slope used to calculate y = slope * x.",
                type="number",
                required=True,
                example=1.5,
                renderAs="number",
                validation=ValidationRule(min=-100, max=100),
            ),
        ],
    ),
    responseMappings=[POINTS_RESPONSE_MAPPING],
)

GRAPH_RANDOM_WALK_OPERATION = OperationDefinition(
    operationId="graphRandomWalk",
    label="Graph random walk",
    description="Returns 100 cumulative Gaussian random-walk points.",
    method="GET",
    path="/graph-random-walk",
    parameters=OperationParameters(
        query=[
            VariableDefinition(
                key="std",
                label="Standard deviation",
                description="Standard deviation of each Gaussian random-walk increment.",
                type="number",
                required=True,
                example=0.75,
                renderAs="number",
                validation=ValidationRule(min=0, max=100),
            ),
        ],
    ),
    responseMappings=[POINTS_RESPONSE_MAPPING],
)

HEALTH_OPERATION = OperationDefinition(
    operationId="health",
    label="Health",
    description="Returns provider health status.",
    method="GET",
    path="/health",
    kind="resource",
    capabilities=["resource"],
    supportsVariables=False,
    responseMappings=[],
)


def dump_contract_model(model: BaseModel) -> dict[str, Any]:
    return model.model_dump(by_alias=True, mode="json", exclude_none=True)


def build_contract(base_url: str | None = None) -> ConnectionContract:
    normalized_base_url = base_url.rstrip("/") if base_url else ""
    openapi_url = f"{normalized_base_url}/openapi.json" if normalized_base_url else "/openapi.json"

    return ConnectionContract(
        contractVersion=1,
        adapter=AdapterInfo(
            id="mock.graph-example",
            title="Mock Graph Example API",
            description=(
                "Example AdapterFromApi provider contract with graph-line and "
                "graph-random-walk query operations."
            ),
        ),
        openapi=OpenApiReference(url=openapi_url),
        configVariables=[
            VariableDefinition(
                key="seriesLabel",
                label="Series label",
                description="Optional label the backend may attach to normalized graph frames.",
                type="string",
                required=False,
                defaultValue="Example series",
                example="Research demo",
                renderAs="text",
                validation=ValidationRule(minLength=1, maxLength=80),
            ),
            VariableDefinition(
                key="environment",
                label="Environment",
                description="Example environment selector used to demonstrate select rendering.",
                type="select",
                required=True,
                defaultValue="demo",
                example="demo",
                renderAs="select",
                options=[
                    FieldOption(label="Demo", value="demo"),
                    FieldOption(label="Development", value="development"),
                ],
            ),
            VariableDefinition(
                key="includeMetadata",
                label="Include metadata",
                description="Whether the backend should preserve non-secret response metadata.",
                type="boolean",
                required=False,
                defaultValue=True,
                example=True,
                renderAs="toggle",
            ),
            VariableDefinition(
                key="displayPrecision",
                label="Display precision",
                description="Decimal precision hint for rendered graph values.",
                type="number",
                required=False,
                defaultValue=6,
                example=4,
                renderAs="number",
                validation=ValidationRule(min=0, max=12),
            ),
            VariableDefinition(
                key="extraTags",
                label="Extra tags",
                description="Optional JSON object of non-secret tags copied into frame metadata.",
                type="json",
                required=False,
                defaultValue={},
                example={"desk": "research", "source": "mock"},
                renderAs="json",
            ),
        ],
        secretVariables=[
            SecretVariableDefinition(
                key="apiToken",
                label="API token",
                description=(
                    "Optional bearer token. The Command Center backend stores this value and "
                    "injects it into upstream requests; it is never returned to the browser."
                ),
                required=False,
                example="example-token",
                renderAs="password",
                injection=InjectionRule(
                    type="header",
                    name="Authorization",
                    template="Bearer {{secret.apiToken}}",
                ),
            ),
        ],
        availableOperations=[GRAPH_LINE_OPERATION, GRAPH_RANDOM_WALK_OPERATION, HEALTH_OPERATION],
        health=HealthContract(
            operationId="health",
            expectedStatus=200,
            timeoutMs=5_000,
        ),
    )


app = FastAPI(
    title="AdapterFromApi Mock Graph Example",
    version="1.0.0",
    description=(
        "FastAPI/Pydantic provider-side example for the Command Center "
        "AdapterFromApi connection contract."
    ),
)


@app.get(
    "/.well-known/command-center/connection-contract",
    response_model=ConnectionContract,
    operation_id="getCommandCenterConnectionContract",
)
async def get_connection_contract(request: Request) -> ConnectionContract:
    return build_contract(str(request.base_url))


@app.get(
    "/graph-line",
    response_model=GraphSeriesResponse,
    operation_id="graphLine",
)
async def graph_line(
    slope: float = Query(
        default=...,
        ge=-100,
        le=100,
        description="Slope used to calculate y = slope * x.",
    ),
) -> GraphSeriesResponse:
    points = [GraphPoint(x=index, y=round(slope * index, 6)) for index in range(100)]

    return GraphSeriesResponse(
        operationId="graphLine",
        label="Graph line",
        points=points,
        metadata={
            "pointCount": 100,
            "slope": slope,
            "generatedAt": datetime.now(UTC).isoformat(),
        },
    )


@app.get(
    "/graph-random-walk",
    response_model=GraphSeriesResponse,
    operation_id="graphRandomWalk",
)
async def graph_random_walk(
    std: float = Query(
        default=...,
        ge=0,
        le=100,
        description="Standard deviation of each Gaussian random-walk increment.",
    ),
) -> GraphSeriesResponse:
    current = 0.0
    points: list[GraphPoint] = []
    rng = random.Random()

    for index in range(100):
        if index > 0:
            current += rng.gauss(0, std)
        points.append(GraphPoint(x=index, y=round(current, 6)))

    return GraphSeriesResponse(
        operationId="graphRandomWalk",
        label="Graph random walk",
        points=points,
        metadata={
            "pointCount": 100,
            "std": std,
            "generatedAt": datetime.now(UTC).isoformat(),
        },
    )


@app.get("/health", response_model=HealthResponse, operation_id="health")
async def health() -> HealthResponse:
    return HealthResponse(ok=True, status="ok")
