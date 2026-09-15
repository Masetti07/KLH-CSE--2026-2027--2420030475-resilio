# Prometheus observability

The FastAPI backend exposes Prometheus text format at `GET /metrics`. Values come from genuine request, processing, analysis, renderer telemetry, and MAPE-K execution paths; no random measurements are generated. Labels are restricted to bounded HTTP methods/routes/statuses and adaptation conditions/strategies.

## Metrics

- `resiliospace_http_requests_total` and `resiliospace_http_request_duration_seconds`: request volume and latency by bounded route template.
- `resiliospace_floor_plan_processing_duration_seconds`, `resiliospace_processing_failures_total`, and `resiliospace_floor_plans_processed_total`: processing timing and outcomes.
- `resiliospace_adaptations_total`: executed adaptations by condition and strategy.
- `resiliospace_adaptive_mode{mode=...}`: four one-hot gauge series. Exactly the current mode (`NORMAL`, `PERFORMANCE`, `DEGRADED`, or `RECOVERY`) is `1`; the other three are `0`.
- `resiliospace_snapshot_recoveries_total`: successful previous-valid-snapshot recovery decisions.
- `resiliospace_vastu_analyses_total`: completed Traditional Vastu Rule Analyses.
- `resiliospace_renderer_telemetry_received_total`, `resiliospace_renderer_fps`, and `resiliospace_reconstruction_confidence`: last reported renderer and reconstruction signals.

Counters reset with the backend process. Renderer values are browser-reported summaries, not server-side frame measurements. Simulation-overridden values drive MAPE-K but are clearly identified in adaptation records and the Resilience Lab; the FPS gauge itself records genuine received renderer telemetry.

Prometheus uses `monitoring/prometheus.yml` and scrapes `backend:8000`, the Compose service hostname. It must not use `localhost` for a separate backend container.
