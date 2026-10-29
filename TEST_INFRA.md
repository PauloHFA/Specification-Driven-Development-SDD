# E2E Test Infra: Cofre 3D de Documentação & Diagramas

## Test Philosophy
- Opaque-box, requirement-driven. No dependency on internal implementation quirks.
- Methodology: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial Testing + Real-World Workload Testing.
- 100% runnable headlessly in pure Node.js via native `node:test` test runner.

## Feature Inventory
| # | Feature | Source (requirement) | Tier 1 | Tier 2 | Tier 3 |
|---|---------|---------------------|:------:|:------:|:------:|
| 1 | F1: Vector3 & 3D Math | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 2 | F2: Camera Navigation & Lerp Kinematics | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 3 | F3: Elastic Physics & Spring-Damper | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 4 | F4: Graph Cycle Detection Engine | ORIGINAL_REQUEST §R2, §R4 | 5 | 5 | ✓ |
| 5 | F5: Dynamic Vibration & Wave Generator | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 6 | F6: SDD Specification Parser & Graph Adapter | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 7 | F7: Synthetic SDD Test Datasets | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ |
| 8 | F8: 3D Vault Web Application & UI Assets | ORIGINAL_REQUEST §R1, R2, R3 | 5 | 5 | ✓ |
| 9 | F9: Local Vault HTTP Server & CLI Entry | ORIGINAL_REQUEST §R1, R3 | 5 | 5 | ✓ |
| 10 | F10: Automated Test Suite & E2E Verification | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ |

## Test Architecture
- **Test Runner**: Native Node.js `node --test` runner (`node --test "test/vault/**/*.test.js"`). Zero external testing dependencies.
- **Test Directory**: `test/vault/`
- **Pass/Fail Semantics**: Process exit code 0, all tests pass, zero uncaught assertions or exceptions.

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Full SDD Repository Parsing (`examples/inscricao-turma/.spec/`) | F1, F3, F4, F6, F7 | High |
| 2 | Synthetic Microservice Architecture with Intentional Circular Dependency | F1, F3, F4, F5, F7 | High |
| 3 | Camera Lerp Transit Across Complex Multi-Cluster Graph | F1, F2, F3 | Medium |
| 4 | Live HTTP API and Asset Serving E2E Check | F8, F9, F6 | Medium |
| 5 | Dynamic Graph Mutation (Adding a cyclic edge at runtime and verifying immediate vibration transition) | F3, F4, F5 | High |

## Coverage Thresholds
- Tier 1 (Feature Coverage): ≥5 per feature (Total: 50 test cases)
- Tier 2 (Boundary & Corner Cases): ≥5 per feature (Total: 50 test cases)
- Tier 3 (Cross-Feature Combinations): ≥10 tests covering key feature pairs
- Tier 4 (Real-World Application Scenarios): ≥5 complete end-to-end integration workflows
- Minimum Test Suite Size: ≥ 115 test cases
