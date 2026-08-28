---
name: azure-infrastructure-bicep
description: Enterprise cloud infrastructure automation on Microsoft Azure using
  Bicep IaC, Azure Container Apps, AKS, Azure OpenAI services, and Managed
  Identities.
metadata:
  author: Agents United DevOps Group
  version: 1.0.0
  license: MIT
  icon: ☁️
disable-slash-command: true
---

# Azure Infrastructure with Bicep Playbook

## Overview & Purpose
`azure-infrastructure-bicep` defines cloud architecture standards and Infrastructure-as-Code (IaC) templates for deploying scalable applications on Microsoft Azure.

## Core Directives & Standards
1. **Modular Bicep Templates** — Organize IaC into reusable Bicep modules (`modules/containerApp.bicep`, `modules/keyVault.bicep`, `modules/openAI.bicep`) with strict parameter typing.
2. **Passwordless Managed Identities** — Use Azure System-Assigned or User-Assigned Managed Identities and Azure RBAC instead of hardcoded connection strings or access keys.
3. **Azure Container Apps (ACA) Microservices** — Deploy containerized workloads with KEDA auto-scaling (HTTP traffic and queue depth scaling) and Dapr sidecars.
4. **Azure OpenAI Service Deployment** — Provision dedicated Azure OpenAI Cognitive Service accounts with private endpoints, virtual network integration, and rate-limit monitoring.
5. **Azure Key Vault Integration** — Store all application secrets in Key Vault and inject them into container environments via Key Vault secret references.

## Verification Checklist
- [ ] Bicep templates pass `az bicep build` and `az deployment group what-if` dry-run validations.
- [ ] Public network access disabled on storage accounts and databases (private endpoints enforced).
