import { AppFlow } from "../types";

const flow: AppFlow = {
  "app": {
    "id": "flash-builder",
    "name": "LeadSite Factory",
    "routing": {
      "initialRoute": "/dashboard",
      "routes": [
        { "path": "/dashboard", "screenId": "dashboard" },
        { "path": "/workspace/:prospectId", "screenId": "workspace" }
      ]
    }
  },
  "state": {
    "stores": {
      "workspace": {
        "initial": {
          "status": "IDLE",
          "artifacts": [],
          "versions": [],
          "errors": [],
          "warnings": [],
          "stateByAgent": {
            "scraper": { 
                "status": "idle",
                "config": {
                    "systemInstruction": "You are an expert business intelligence analyst. Your goal is to generate realistic, structured company profiles based on a name or ID.",
                    "temperature": 0.7
                }
            },
            "copywriter": { 
                "status": "idle", 
                "config": {
                    "systemInstruction": "You are a world-class marketing copywriter. You write punchy, high-conversion landing page copy. Tone: Professional, Innovative, yet accessible.",
                    "temperature": 0.8
                }
            },
            "designer": { 
                "status": "idle",
                "config": {
                    "systemInstruction": "You are a UI Designer. Suggest an image URL from unsplash representing a tech abstract background.",
                    "temperature": 0.5
                }
            }
          }
        }
      }
    }
  },
  "actions": {
    "toggleTheme": {
      "type": "command",
      "effects": [
        { "op": "dispatch", "target": "app.toggleTheme", "payload": {} }
      ]
    },
    "createWorkspace": {
      "type": "command",
      "effects": [
        { "op": "dispatch", "target": "workspace.create", "payload": { "draft": "{{draftIntake}}" } }
      ]
    },
    "loadWorkspace": {
      "type": "command",
      "effects": [
        { "op": "dispatch", "target": "workspace.load", "payload": { "prospectId": "{{params.prospectId}}" } }
      ]
    },
    "runScraper": {
      "type": "command",
      "effects": [
        { "op": "dispatch", "target": "orchestrator.runAgent", "payload": { "agentName": "scraper", "prospectId": "{{workspace.prospectId}}" } }
      ]
    },
    "runCopywriter": {
      "type": "command",
      "effects": [
         { "op": "dispatch", "target": "orchestrator.runAgent", "payload": { "agentName": "copywriter", "prospectId": "{{workspace.prospectId}}" } }
      ]
    },
    "runDesigner": {
      "type": "command",
      "effects": [
         { "op": "dispatch", "target": "orchestrator.runAgent", "payload": { "agentName": "designer", "prospectId": "{{workspace.prospectId}}" } }
      ]
    },
    "refineArtifact": {
        "type": "command",
        "effects": [
            { "op": "dispatch", "target": "orchestrator.refineArtifact", "payload": { "artifactId": "{{params.artifactId}}", "instruction": "{{params.instruction}}" } }
        ]
    },
    "saveArtifact": {
      "type": "command",
      "effects": [
        { "op": "dispatch", "target": "artifacts.applyPatch", "payload": { "artifactId": "{{params.artifactId}}", "patch": "{{params.patch}}" } }
      ]
    },
    "snapshotWorkspace": {
      "type": "command",
      "effects": [
        { "op": "dispatch", "target": "versions.snapshot", "payload": { "note": "{{params.note}}" } }
      ]
    },
    "selectArtifact": {
      "type": "command",
      "effects": [
        { "op": "set", "path": "workspace.selectedArtifactId", "value": "{{params.artifactId}}" },
        { "op": "set", "path": "workspace.selectedTab", "value": "profile" } 
      ]
    },
    "openAgentSettings": {
        "type": "command",
        "effects": [
            { "op": "set", "path": "ui.activeAgentSettings", "value": "{{params.agentName}}" }
        ]
    },
    "closeAgentSettings": {
        "type": "command",
        "effects": [
            { "op": "set", "path": "ui.activeAgentSettings", "value": null }
        ]
    },
    "updateAgentConfig": {
        "type": "command",
        "effects": [
            { "op": "set", "path": "workspace.stateByAgent.{{params.agentName}}.config.systemInstruction", "value": "{{params.systemInstruction}}" },
            { "op": "set", "path": "workspace.stateByAgent.{{params.agentName}}.config.temperature", "value": "{{params.temperature}}" },
            { "op": "dispatch", "target": "ui.notify", "payload": { "type": "success", "message": "Agent brain reprogrammed" } },
            { "op": "set", "path": "ui.activeAgentSettings", "value": null }
        ]
    }
  },
  "screens": [
    {
      "id": "dashboard",
      "type": "Page",
      "layout": {
        "type": "Workspace3Pane",
        "header": {
          "title": "LeadSite Factory",
          "subtitle": "Select a template to begin",
          "actions": [
            { "type": "Button", "label": "{{app.settings.grayscale ? 'Color' : 'B/W'}}", "variant": "secondary", "onClick": { "$action": "toggleTheme" } }
          ]
        },
        "center": {
          "type": "Stack",
          "gap": 6,
          "children": [
            {
              "type": "Card",
              "title": "New Project",
              "children": [
                { "type": "TextInput", "label": "Project Name", "path": "draftIntake.prospectName", "placeholder": "Acme Corp" },
                { "type": "Button", "label": "Initialize Workspace", "variant": "primary", "onClick": { "$action": "createWorkspace" } }
              ]
            },
            {
               "type": "Grid",
               "columns": 2,
               "gap": 4,
               "children": [
                 { "type": "StatsCard", "label": "Total Projects", "value": "12" },
                 { "type": "StatsCard", "label": "Agents Active", "value": "3" }
               ]
            }
          ]
        },
        "left": { "agents": [] },
        "right": { "sections": [] }
      }
    },
    {
      "id": "workspace",
      "type": "Page",
      "onEnter": [
        { "op": "action", "name": "loadWorkspace", "params": { "prospectId": "{{route.params.prospectId}}" } }
      ],
      "layout": {
        "type": "Workspace3Pane",
        "header": {
          "title": "{{workspace.prospectName}}",
          "subtitle": "Workspace ID: {{workspace.prospectId}}",
          "actions": [
            { "type": "Button", "label": "{{app.settings.grayscale ? 'Color' : 'B/W'}}", "variant": "secondary", "onClick": { "$action": "toggleTheme" } },
            { "type": "Button", "label": "Snapshot", "variant": "secondary", "onClick": { "$action": "snapshotWorkspace", "params": { "note": "User requested" } } }
          ]
        },
        "left": {
          "agents": [
            {
              "name": "scraper",
              "role": "Data Analyst",
              "avatar": "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=scraper&backgroundColor=transparent",
              "statusPath": "workspace.stateByAgent.scraper.status",
              "primaryAction": { "label": "Scan", "onClick": { "$action": "runScraper" } },
              "settingsAction": { "$action": "openAgentSettings", "params": { "agentName": "scraper" } }
            },
            {
              "name": "copywriter",
              "role": "Creative Lead",
              "avatar": "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=copywriter&backgroundColor=transparent",
              "statusPath": "workspace.stateByAgent.copywriter.status",
              "primaryAction": { "label": "Draft", "onClick": { "$action": "runCopywriter" } },
              "settingsAction": { "$action": "openAgentSettings", "params": { "agentName": "copywriter" } }
            },
            {
              "name": "designer",
              "role": "UI/UX Architect",
              "avatar": "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=designer&backgroundColor=transparent",
              "statusPath": "workspace.stateByAgent.designer.status",
              "primaryAction": { "label": "Design", "onClick": { "$action": "runDesigner" } },
              "settingsAction": { "$action": "openAgentSettings", "params": { "agentName": "designer" } }
            }
          ],
          "secondary": {
             "type": "ArtifactsExplorer",
             "bind": "workspace.artifacts",
             "onOpen": { "$action": "selectArtifact", "params": { "artifactId": "{{item.id}}" } } 
          }
        },
        "center": {
          "type": "Canvas",
          "tabs": [
            { "id": "profile", "label": "Profile" },
            { "id": "copy", "label": "Copy" },
            { "id": "design", "label": "Design" }
          ],
          "selectedTabPath": "workspace.selectedTab",
          "editor": {
            "artifactIdPath": "workspace.selectedArtifactId",
            "onSave": { "$action": "saveArtifact" },
            "onRefine": { "$action": "refineArtifact" }
          },
          "emptyState": {
            "when": "workspace.artifacts.length == 0",
            "title": "Waiting for Agents",
            "text": "Run the Scraper agent on the left to generate initial data artifacts.",
            "primary": { "label": "Quick Start", "onClick": { "$action": "runScraper" } }
          }
        },
        "right": {
          "sections": [
            { "type": "Status" },
            {
                "type": "Timeline",
                "steps": [
                    { "id": "1", "label": "Discovery & Research", "agent": "scraper" },
                    { "id": "2", "label": "Strategy & Messaging", "agent": "copywriter" },
                    { "id": "3", "label": "Visual Identity", "agent": "designer" }
                ]
            },
            { 
              "type": "Checklist",
              "title": "Quality Gates",
              "items": [
                 { "id": "c1", "label": "Data Validated", "path": "workspace.flags.isValid" },
                 { "id": "c2", "label": "Tone Check", "path": "workspace.flags.toneOk" }
              ]
            }
          ]
        }
      }
    }
  ]
};

export default flow;