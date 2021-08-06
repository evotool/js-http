# Introduction

`@evojs/http` is a node.js http framework for building backend applications.

## Philosophy

Keep it simple and don't overload the system.

## Main features

The main features are:

1. Simple code structure;
2. Built-in validation support (@evojs/validator);
3. Built-in support for handling different types of requests (urlencoded, json, multipart, text, raw, stream);
4. Three-level middleware support (global, controller, endpoint);
5. Initializing dynamic providers;
6. Dependency injection.

## Installation

To get started, you can use the `@evojs/cli`.

```bash
npm i @evojs/cli -g
evojs http new project-name
```

Useful scripts:

- `npm run dev` - starting the project in dev mode
- `npm run build` - build the project in prod mode
- `npm run start` - starting the project in prod mode
