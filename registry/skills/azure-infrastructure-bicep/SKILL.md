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

## Execution Triggers
- A specialist's Skill Consultation Map names this skill for a task touching Azure Bicep IaC, Azure Container Apps, Azure OpenAI provisioning, or Azure Static Web Apps routing/auth.
- A project's `bundles.json` addon (`devops-engineering`) is installed and an `infra/*.bicep` template, ACA manifest, or `staticwebapp.config.json` needs authoring or review.

## Input/Output Requirements
- **Input**: the target Azure resource types (ACA, Azure OpenAI, Static Web Apps, Key Vault), the environment tier, and any existing `infra/` Bicep modules.
- **Output**: modular Bicep template(s) with Managed Identity bindings, and/or a `staticwebapp.config.json` — plus the `az bicep lint`/`build` dry-run results.

## Step-by-Step Runbook
1. Inspect existing `infra/` modules and parameter files before adding a new resource.
2. Author or extend a modular Bicep template, binding Managed Identity + Key Vault references instead of connection strings (`references/backend-frontend-devops-exemplars.md`).
3. Run `az bicep lint` and `az bicep build` (or `az deployment group what-if`) as a dry-run before handing the deploy command to the orchestrator.
4. For a client-facing app, pair the ACA/OpenAI template with an Azure Static Web Apps routing/auth config where applicable.

## Core Directives & Standards
1. **Modular Bicep Templates** — Organize IaC into reusable Bicep modules (`modules/containerApp.bicep`, `modules/keyVault.bicep`, `modules/openAI.bicep`) with strict parameter typing.
2. **Passwordless Managed Identities** — Use Azure System-Assigned or User-Assigned Managed Identities and Azure RBAC instead of hardcoded connection strings or access keys.
3. **Azure Container Apps (ACA) Microservices** — Deploy containerized workloads with KEDA auto-scaling (HTTP traffic and queue depth scaling) and Dapr sidecars.
4. **Azure OpenAI Service Deployment** — Provision dedicated Azure OpenAI Cognitive Service accounts with private endpoints, virtual network integration, and rate-limit monitoring.
5. **Azure Key Vault Integration** — Store all application secrets in Key Vault and inject them into container environments via Key Vault secret references.

## Code & Config Exemplars
- `references/backend-frontend-devops-exemplars.md` — Azure OpenAI managed-identity call
  (backend), Static Web Apps routing/auth config (frontend), and a modular ACA + Azure OpenAI
  Bicep template with deploy/lint commands (devops). Extracted per Plan 025 Objective 4.

## Edge Cases & Error Recovery
- **`az bicep what-if` shows an unexpected resource replacement**: treat it as a stop condition — replacement usually means data loss (e.g. a storage account rename); redesign the change as additive first.
- **Managed Identity lacks a role assignment**: grant the least-privilege RBAC role scoped to the resource, never a subscription-wide Owner/Contributor role.
- **Azure OpenAI deployment quota exceeded**: report the quota error to the orchestrator with the requested capacity instead of silently retrying with a smaller value.

## Verification Checklist
- [ ] Bicep templates pass `az bicep build` and `az deployment group what-if` dry-run validations.
- [ ] Public network access disabled on storage accounts and databases (private endpoints enforced).
