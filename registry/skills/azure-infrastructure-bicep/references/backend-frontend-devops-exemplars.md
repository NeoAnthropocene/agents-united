# Azure — Backend, Frontend & DevOps Exemplars

> Extracted verbatim from `registry/agents/subagent-backend-architect.md`,
> `subagent-frontend-architect.md` and `subagent-devops-engineer.md` per Plan 025 Objective 4
> (code exemplars live in the skill, not the specialist body). Consulted by
> `subagent-backend-architect`, `subagent-frontend-architect` and `subagent-devops-engineer`
> via their Skill Consultation Map.

## 1. Azure OpenAI — Managed Identity API Call from ACA

```typescript
// src/services/azure-openai.ts — Zero-credential Azure OpenAI call via Managed Identity
import { DefaultAzureCredential } from '@azure/identity';

export async function callAzureOpenAI(userMessage: string): Promise<string> {
  const credential = new DefaultAzureCredential();
  const tokenResponse = await credential.getToken('https://cognitiveservices.azure.com/.default');

  const endpoint = process.env.AZURE_OPENAI_ENDPOINT!; // e.g. https://oai-myapp-prod.openai.azure.com
  const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT!; // e.g. gpt-4o

  const response = await fetch(
    `${endpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=2024-02-01`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenResponse.token}`,
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: userMessage }],
        max_tokens: 512,
      }),
    }
  );

  const json = await response.json();
  return json.choices[0].message.content as string;
}
```

## 2. Azure Static Web Apps — Custom Routing & Auth Config

```json
// staticwebapp.config.json — SWA routing and auth provider config
{
  "routes": [
    { "route": "/api/*", "allowedRoles": ["authenticated"] },
    { "route": "/admin/*", "allowedRoles": ["admin"] },
    { "route": "/.auth/login/aad", "rewrite": "/.auth/login/aad" }
  ],
  "navigationFallback": { "rewrite": "/index.html", "exclude": ["/api/*", "/_framework/*"] },
  "responseOverrides": {
    "401": { "redirect": "/.auth/login/aad", "statusCode": 302 }
  },
  "auth": {
    "identityProviders": {
      "azureActiveDirectory": {
        "registration": {
          "openIdIssuer": "https://login.microsoftonline.com/<TENANT_ID>/v2.0",
          "clientIdSettingName": "AZURE_CLIENT_ID",
          "clientSecretSettingName": "AZURE_CLIENT_SECRET"
        }
      }
    }
  }
}
```

## 3. Azure Bicep Deployment Commands & Modular Template (ACA + Azure OpenAI)

```bash
# Validate and lint Bicep templates
az bicep lint --file infra/main.bicep
az bicep build --file infra/main.bicep

# Deploy infrastructure to Azure Resource Group
az deployment group create \
  --resource-group rg-production-eastus \
  --template-file infra/main.bicep \
  --parameters environment=prod location=eastus \
  --parameters openAiModelName=gpt-4o
```

```bicep
// infra/main.bicep — Modular Azure Container Apps & Azure OpenAI Architecture
targetScope = 'resourceGroup'

@description('Deployment environment (dev, staging, prod)')
param environment string = 'prod'

@description('Azure region for resources')
param location string = resourceGroup().location

@description('OpenAI model deployment name')
param openAiModelName string = 'gpt-4o'

// 1. Log Analytics Workspace
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: 'law-agents-${environment}'
  location: location
  properties: { sku: { name: 'PerGB2018' }, retentionInDays: 30 }
}

// 2. Azure Container Apps Managed Environment
resource containerAppEnv 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: 'cae-agents-${environment}'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: { customerId: logAnalytics.properties.customerId, sharedKey: logAnalytics.listKeys().primarySharedKey }
    }
  }
}

// 3. Azure Container App with KEDA Scaling & Dapr
resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: 'app-agent-service-${environment}'
  location: location
  identity: { type: 'SystemAssigned' }
  properties: {
    managedEnvironmentId: containerAppEnv.id
    configuration: {
      ingress: { external: true, targetPort: 3000 }
      dapr: { enabled: true, appId: 'agent-service', appPort: 3000 }
    }
    template: {
      containers: [
        {
          name: 'service'
          image: 'mcr.microsoft.com/azuredocs/aci-helloworld:latest'
          resources: { cpu: json('0.5'), memory: '1.0Gi' }
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 10
        rules: [
          {
            name: 'http-scaling'
            http: { metadata: { concurrentRequests: '50' } }
          }
        ]
      }
    }
  }
}

// 4. Azure OpenAI Service with Managed Identity Access
resource openAiAccount 'Microsoft.CognitiveServices/accounts@2023-05-01' = {
  name: 'oai-agents-${environment}'
  location: location
  sku: { name: 'S0' }
  kind: 'OpenAI'
  properties: {
    customSubDomainName: 'oai-agents-${environment}-${uniqueString(resourceGroup().id)}'
    publicNetworkAccess: 'Enabled'
  }
}

resource openAiDeployment 'Microsoft.CognitiveServices/accounts/deployments@2023-05-01' = {
  parent: openAiAccount
  name: openAiModelName
  sku: { name: 'Standard', capacity: 30 }
  properties: {
    model: { format: 'OpenAI', name: openAiModelName, version: '2024-05-13' }
  }
}

output containerAppFqdn string = containerApp.properties.configuration.ingress.fqdn
output openAiEndpoint string = openAiAccount.properties.endpoint
```
