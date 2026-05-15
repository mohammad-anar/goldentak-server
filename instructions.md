  # Backend Instructions & Guidelines

This document outlines the standard practices, architectural patterns, and conventions used in the `azan-munir-server` backend codebase. When contributing to or iterating on this project, please adhere to these guidelines.

## 1. Folder Structure

The project follows a localized, modular, and domain-driven folder architecture:
- **`src/`**: The root directory for all source code.
  - **`app.ts`**: Express application setup, global middlewares, and root routing.
  - **`server.ts`**: Application entry point, server bootstrap, database/socket initialization, and graceful shutdown handling.
  - **`app/modules/`**: Contains domain-specific modules (e.g., `auth`, `bike`, `booking`, `job`). Each module encapsulates its own routes, controllers, services, interfaces, and validations.
  - **`app/routes/index.ts`**: The centralized router that aggregates all module-level routes.
  - **`app/middlewares/`**: Global middlewares such as `globalErrorHandler.ts` and `notFound.ts`.
  - **`app/shared/`**: Common reusable utilities (e.g., `catchAsync.ts`, `sendResponse.ts`).
  - **`config/`**: Environment variable configurations (`index.ts`).
  - **`helpers.ts/`**: Helper files (like `socketHelper.ts`, `pick.ts`).
  - **`types/`**: Global type declarations.

## 2. Naming Conventions

- **Modules**: Module folders use `camelCase` and are typically named as singular nouns (e.g., `jobOffer`, `chatNotification`, `auth`).
- **File Names**: Files inside a module follow a structured pattern indicating their role: `[moduleName].[type].ts`.
  - e.g., `user.controller.ts`, `user.service.ts`, `user.route.ts`, `user.validation.ts`, `user.interface.ts`.
- **Exports**: Major logic chunks (controllers, services, validations) are grouped into objects and exported with `PascalCase` names (e.g., `export const UserController = { ... }`, `export const UserValidation = { ... }`).
- **Imports (ESM Requirement)**: Since this is defined as `"type": "module"` in `package.json`, local file imports **MUST** include the `.js` extension (e.g., `import { UserService } from "./user.service.js";`). 

## 3. Type Safety Usage

The codebase is heavily typed using TypeScript and integrated with runtime type safety tools:
- **Static Typing (TypeScript)**: Utilize strict typings for function parameters and return types. Avoid the `any` keyword whenever possible.
- **Database Types (Prisma)**: Prisma auto-generates types from the schema. Use them for typing DB operations (e.g., `Prisma.UserCreateInput`).
- **Runtime Validation (Zod)**: Use Zod to validate incoming HTTP requests. Schemas are defined in `[moduleName].validation.ts` (e.g., `createUserZodSchema`) and should be enforced via middleware before reaching the controller.
- **Express Types**: Use types like `Request`, `Response`, `NextFunction` from `"express"` inside controllers and middlewares.

## 4. Pathing

- **Base URL Imports**: `tsconfig.json` sets `baseUrl: "."`. This allows absolute imports starting from `src/` (e.g., `import config from "src/config/index.js";`).
- **Relative Imports**: Sibling or deeply nested module files often use relative imports (e.g., `import { UserRouter } from "../modules/auth/user.route.js";`).
- **IMPORTANT**: As mentioned above, **always append `.js`** to the end of relative and absolute local file imports to satisfy the ES2020/Node16 modules resolution used in this project.

## 5. Routing

- **Centralized Routing**: All module routes must be registered in `src/app/routes/index.ts` within the `moduleRoutes` array.
  ```typescript
  import { UserRouter } from "../modules/auth/user.route.js";
  const moduleRoutes = [
    {
      path: "/auth",
      route: UserRouter,
    },
    // ...
  ]
  ```
- **Module Routes**: Each module defines its endpoints using `express.Router()` in `[moduleName].route.ts`.
- **Base Endpoint**: The centralized `router` is mounted in `app.ts` under the base path `/api/v1` (`app.use("/api/v1", router);`).

## 6. Build & Compilation Check

To check for type errors and build the project, run:
```bash
pnpm build
```
- Under the hood, this executes `tsc` using the local `tsconfig.json`.
- **Note**: The current `tsconfig.json` does not specify an `outDir`. Calling `tsc` will generate compiled `.js` files alongside your `.ts` source files. If your goal is just checking type safety without emitting files, use `tsc --noEmit` if you customize the package script. Wait for the `pnpm build` command to finish with `exit code 0` to confirm there are no type discrepancies.

## 7. Creating a New Module

To create a new full module from start to finish via an AI prompt or manual scaffolding, ensure the following steps are performed:

1. **Create the Module Directory**: Create a folder `src/app/modules/[moduleName]` (use `camelCase` for the folder name).
2. **Schema & Types**:
   - Update `prisma/schema.prisma` with the new models and run `npx prisma db push` or `npx prisma migrate dev`.
   - Create `[moduleName].interface.ts` if specific utility types beyond Prisma are needed.
3. **Zod Validation**:
   - Create `[moduleName].validation.ts`.
   - Export schemas like `create[ModuleName]ZodSchema` and `update[ModuleName]ZodSchema`.
4. **Service Layer**:
   - Create `[moduleName].service.ts`.
   - Implement business logic and DB interactions (CRUD operations, filtering, etc.).
   - Export logic as a group: `export const [ModuleName]Service = { ... }`.
5. **Controller Layer**:
   - Create `[moduleName].controller.ts`.
   - Implement request handling, using `catchAsync()`, `pick()`, and `sendResponse()`.
   - Ensure the `.service.js` and other internal imports end in `.js`.
   - Export as `export const [ModuleName]Controller = { ... }`.
6. **Routes**:
   - Create `[moduleName].route.ts` (or `.routes.ts`).
   - Define endpoints `router.post(...)`, `router.get(...)`.
   - Apply validations using `validateRequest([ModuleName]Validation...)` middleware where appropriate.
   - Export the router (e.g., `export const [ModuleName]Router = router;`).
7. **Register Route**:
   - Go to `src/app/routes/index.ts`.
   - Import the new route file (`import { [ModuleName]Router } from "../modules/[moduleName]/[moduleName].route.js";`). Always include the `.js` extension!
   - Add the route to the `moduleRoutes` array with its base path.
