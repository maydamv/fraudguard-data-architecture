# 🛡️ FraudGuard — Real-Time Fraud Detection Data Architecture

> Final Data Engineering Project. Designed to be a complete data platform for a digital payments company that processes over **50M+ transactions/day**.

---

## Overview

FraudGuard is a data architecture for real-time fraud detection in digital payments. The system must decide whether to approve or block a transaction in **under 200ms**, while also supporting deep analytics, ML model retraining, and multi-team data access.

This repo contains:

- 📊 The full architecture presentation (`.pptx`)
- ⚡ An interactive pipeline simulator (React component)
- 📄 Architecture documentation

---

## Architecture Summary

```
[Mobile App / Web / Bank APIs]
          │
          ▼
    ┌─────────────┐
    │ Apache Kafka │  ← ingestion layer, fan-out to all consumers
    └──────┬──────┘
           │
    ┌──────┴──────────────────────────────┐
    │                                     │
    ▼                                     ▼
REAL-TIME PATH (<200ms)           BATCH PATH (every 1-6h)
    │                                     │
 Apache Flink                        Apache Spark
 (feature extraction)                (aggregations)
    │                                     │
 Redis Cache                           dbt Models
 (user history lookup)                 (transformations)
    │                                     │
 XGBoost ML Model                   ClickHouse DW
 (fraud scoring)                    (OLAP analytics)
    │                                     │
 Decision Engine               Metabase Dashboards
 (BLOCK / REVIEW / APPROVE)     + ML Retraining (Airflow)
```

---

## Components

| Layer                    | Technology             | Why                                                         |
| ------------------------ | ---------------------- | ----------------------------------------------------------- |
| **Ingestion**            | Apache Kafka           | Replay, fan-out, fault tolerance at scale                   |
| **Real-time processing** | Apache Flink           | True sub-second latency (vs Spark's 1-2s micro-batch)       |
| **Batch processing**     | Apache Spark + dbt     | Cost-effective aggregations, SQL transformations            |
| **Operational DB**       | PostgreSQL             | Source of truth for users, accounts, rules                  |
| **Analytical DW**        | ClickHouse             | Columnar OLAP, sub-second queries on billions of rows       |
| **Feature cache**        | Redis                  | <1ms feature lookups for ML model at inference time         |
| **Data lake**            | S3 (Parquet)           | Infinite, cheap storage for raw events and ML training data |
| **Orchestration**        | Apache Airflow         | Batch pipeline scheduling, ML retraining pipelines          |
| **Schema management**    | Avro + Schema Registry | Backward-compatible schema evolution across Kafka topics    |

---

## Data Flow

### Real-Time (< 200ms)

```
Transaction Event
  → Kafka topic: payments.raw
  → Flink Job: extracts velocity, geo, time features
  → Redis: fetches user behavioral history
  → XGBoost: returns fraud score (0–1)
  → Decision Engine: APPROVE / REVIEW / BLOCK
```

### Batch (every 1–6 hours)

```
S3 Data Lake (raw Parquet)
  → Spark Job: aggregations by hour/day/merchant
  → dbt Models: business transformations + data quality tests
  → ClickHouse: loaded for analyst queries
  → Airflow: triggers ML model retraining weekly
```

---

## Repo Structure

```
fraudguard-data-architecture/
├── presentation/
│   └── FraudGuard_Architecture.pptx     # Architecture slides
├── simulator/
│   └── fraudguard_simulator.jsx         
├── simulator-app/                       # Runnable React app
│   ├── public/
│   ├── src/
│   │   ├── App.js                       
│   │   └── FraudGuardSimulator.jsx      
│   └── package.json
└── README.md
```

---

## Key Design Decisions

**Why Kafka over a simple message queue?**
Multiple consumers (Flink, S3 writer, audit log) need to read the same events independently. Kafka's log-based architecture allows replay if a consumer fails, which a traditional queue (RabbitMQ) doesn't support well at this scale.

**Why Flink and not Spark Streaming?**
Flink processes events with true event-time semantics and sub-second latency. Spark Structured Streaming uses micro-batches of 1–2 seconds — too slow for a 200ms decision window.

**Why ClickHouse and not PostgreSQL for analytics?**
ClickHouse is a columnar OLAP database designed for analytical workloads. It handles queries over billions of rows in seconds. PostgreSQL would require expensive indexes and partitioning to reach the same performance.

**Why Redis for ML features?**
At 50M transactions/day, the ML model needs user behavioral features (velocity, avg spend, geo history) at inference time. Redis serves these in <1ms. A PostgreSQL query would add 20–50ms and become the bottleneck in the 200ms budget.

---

## Scaling

| Scenario                       | Response                                                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **10× data volume**            | Kafka: add partitions. Flink: scale task managers on Kubernetes. ClickHouse: shard by `merchant_id`. S3 scales infinitely.                 |
| **DB doesn't fit one machine** | ClickHouse: distributed `ReplicatedMergeTree`. Redis: Redis Cluster with consistent hashing. PostgreSQL: Citus extension for sharding.     |
| **Schema changes**             | Avro + Schema Registry enforces backward compatibility. SCD Type 2 in ClickHouse preserves full history. dbt handles warehouse migrations. |
| **Multiple teams need data**   | Kafka topics per domain. Separate ClickHouse schemas per team. dbt data marts. Long-term: Data Mesh with domain ownership.                 |
| **New products / regions**     | New Kafka topics per product line. New dbt models deployed independently. Feature Store: add feature sets without ML redeploy.             |

---

## Running the Simulator

The interactive simulator shows the real-time pipeline in action — stages light up as each transaction flows through the system.

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/fraudguard-data-architecture
cd fraudguard-data-architecture/simulator-app

# Install dependencies
npm install

# Run (require a React environment)
npm start
```

Or open `fraudguard_simulator.jsx` directly as a component in any React app

---

## References

- [Apache Kafka Documentation](https://kafka.apache.org/documentation/)
- [Apache Flink — Stateful Stream Processing](https://flink.apache.org/)
- [ClickHouse — Column-Oriented DBMS](https://clickhouse.com/docs)
- [dbt — Data Build Tool](https://docs.getdbt.com/)
- [Redis — In-Memory Data Store](https://redis.io/docs/)
- [Apache Airflow](https://airflow.apache.org/docs/)

---

_Data Engineering Final Project_
