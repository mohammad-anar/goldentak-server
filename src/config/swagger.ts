import swaggerJSDoc from "swagger-jsdoc";

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "GoldenTak Horse Racing API",
      version: "1.0.0",
      description:
        "REST API for the GoldenTak Horse Racing analysis platform — manage races, horses, jockeys, and advanced algorithmic scoring.",
      contact: { name: "GoldenTak Support" },
    },
    servers: [
      { url: "http://localhost:5000/api/v1", description: "Development" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        // ── Auth ──────────────────────────────────────────────────────────
        LoginBody: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email:    { type: "string", format: "email", example: "admin@gmail.com" },
            password: { type: "string", example: "12345678" },
          },
        },
        // ── Horse ─────────────────────────────────────────────────────────
        Horse: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string", example: "Road To Wembley" },
            age: { type: "integer", example: 5 },
            sex: { type: "string", example: "gelding" },
            sireName: { type: "string" },
            damName: { type: "string" },
            totalRaces: { type: "integer" },
            wins: { type: "integer" },
            totalEarnings: { type: "number" },
          },
        },
        // ── Race ──────────────────────────────────────────────────────────
        Race: {
          type: "object",
          properties: {
            id: { type: "string" },
            externalId: { type: "string" },
            name: { type: "string", example: "Inkerman London Novices' Hurdle" },
            date: { type: "string", format: "date-time" },
            location: { type: "string", example: "Aintree" },
            status: { type: "string", enum: ["UPCOMING", "FINISHED", "CANCELLED"] },
          },
        },

        // ── Shared ────────────────────────────────────────────────────────
        SuccessResponse: {
          type: "object",
          properties: {
            success:    { type: "boolean", example: true },
            message:    { type: "string", example: "Operation successful" },
            meta:       { $ref: "#/components/schemas/PaginatedMeta" },
            data:       { type: "object" },
          },
        },
        PaginatedMeta: {
          type: "object",
          properties: {
            page:      { type: "integer", example: 1 },
            limit:     { type: "integer", example: 10 },
            total:     { type: "integer", example: 53 },
            totalPage: { type: "integer", example: 6 },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            success:    { type: "boolean", example: false },
            message:    { type: "string", example: "Error message" },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ["./src/app/modules/**/*.route.ts"],
};

export const swaggerSpec = swaggerJSDoc(options);


