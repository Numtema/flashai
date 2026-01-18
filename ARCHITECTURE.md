# ⚡ Flash AI Builder - Architecture Documentation

## 1. Philosophie : "The Flash Engine"
Cette application repose sur une architecture **JSON-Driven UI**. 
Contrairement à une app React classique où les vues sont codées en dur, ici l'interface est définie par une configuration (`config/app.flow.ts`) interprétée par un moteur (`engine/renderer.tsx`).

### Pourquoi ?
- **Vitesse d'itération** : On peut changer tout le layout d'une page sans toucher au code React, juste en modifiant le JSON.
- **IA-Ready** : Il est trivial pour une IA de générer ou modifier l'interface puisqu'il s'agit simplement de manipuler un objet JSON.

## 2. Structure du Code

```
src/
├── config/           # Le Cerveau 🧠
│   └── app.flow.ts   # Définition complète de l'app (Routes, Actions, Vues)
├── engine/           # Le Moteur ⚙️
│   ├── renderer.tsx  # Transforme le JSON en composants React
│   ├── actions.ts    # Exécuteur de commandes (navigate, api call, state update)
│   ├── bindings.ts   # Résolveur de variables ({{workspace.id}})
│   └── guards.ts     # Logique conditionnelle (when: "status == 'DONE'")
├── components/       # La Peau 🎨
│   └── Primitives.tsx# Composants UI atomiques (Flash Design System)
├── services/         # Les Compétences 🛠️
│   ├── orchestrator.ts # Gestion des agents AI (Scraper, Copywriter...)
│   └── live.ts       # Interface Vocale (Gemini Live API)
└── store/            # La Mémoire 💾
    └── useAppStore.ts# State Manager (Zustand + Immer)
```

## 3. Concepts Clés

### A. Le Flux de Données (Unidirectional)
1. **Action** : L'utilisateur clique sur un bouton (`$action: "runScraper"`).
2. **Engine** : `runAction()` lit la définition dans `app.flow.ts`.
3. **Dispatch** : Une commande est envoyée via l'`eventBus`.
4. **Service** : L'`orchestrator` attrape l'événement, appelle Gemini API.
5. **Store** : Le résultat met à jour le `workspace` dans Zustand.
6. **Renderer** : L'interface se met à jour automatiquement (Reactive).

### B. Le Système d'Artefacts
Les "Artefacts" sont les unités de production (un texte, une image, une donnée).
- Ils sont stockés dans `workspace.artifacts`.
- Ils supportent le **Versioning** et le **Patching** (JSON Patch).
- Ils sont modifiables via l'interface (Refine / Edit).

### C. Live Voice Control
L'application utilise l'API Gemini Live via WebSocket pour permettre un contrôle vocal temps réel.
- Le service `live.ts` gère le flux audio (PCM 16kHz).
- Il expose des outils (`functionDeclarations`) au modèle pour qu'il puisse piloter l'interface ("Lance le scraper").

## 4. Design System (Flash UI)
- **Silent UI** : Couleurs sombres, contrastes forts uniquement sur les actions clés.
- **Glassmorphism** : Utilisation intensive de `backdrop-blur` et bordures translucides.
- **Motion** : Animations CSS rapides (<200ms) pour une sensation de réactivité immédiate.
- **Mobile First** : Navigation via "Floating Dock" sur mobile, Sidebar sur Desktop.

---
*Généré par Flash AI Architect*
