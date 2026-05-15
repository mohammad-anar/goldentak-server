import swaggerJSDoc from "swagger-jsdoc";

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Fantasy UFC League API",
      version: "1.0.0",
      description:
        "REST API for the Fantasy UFC League platform — manage fighters, events, leagues, drafts, and scoring.",
      contact: { name: "Gabriel" },
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
        RegisterBody: {
          type: "object",
          required: ["name", "username", "email", "password"],
          properties: {
            name:      { type: "string", example: "John Doe" },
            username:  { type: "string", example: "johndoe" },
            email:     { type: "string", format: "email", example: "john@example.com" },
            password:  { type: "string", minLength: 8, example: "Password123" },
            phone:     { type: "string", example: "+1234567890" },
            bio:       { type: "string", example: "UFC fan" },
            location:  { type: "string", example: "New York, USA" },
            timezone:  { type: "string", example: "America/New_York" },
          },
        },
        LoginBody: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email:    { type: "string", format: "email", example: "john@example.com" },
            password: { type: "string", example: "Password123" },
          },
        },
        // ── Division ──────────────────────────────────────────────────────
        DivisionBody: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", example: "Heavyweight" },
          },
        },
        // ── Fighter ───────────────────────────────────────────────────────
        FighterBody: {
          type: "object",
          required: ["name", "nationality", "divisionId"],
          properties: {
            name:        { type: "string", example: "Jon Jones" },
            nickname:    { type: "string", example: "Bones" },
            nationality: { type: "string", example: "USA" },
            divisionId:  { type: "string", example: "clxyz123" },
            rank:        { type: "integer", example: 1 },
            avgL5:       { type: "integer", example: 85 },
            bio:         { type: "string", example: "UFC Heavyweight Champion" },
            avatarUrl:   { type: "string", example: "https://cdn.example.com/fighter.jpg" },
            age:         { type: "integer", example: 36 },
            height:      { type: "string", example: "6'4\"" },
            wins:        { type: "integer", example: 27 },
            losses:      { type: "integer", example: 1 },
            draws:       { type: "integer", example: 0 },
            isActive:    { type: "boolean", example: true },
          },
        },
        // ── Event ─────────────────────────────────────────────────────────
        EventBody: {
          type: "object",
          required: ["name", "location", "date"],
          properties: {
            name:      { type: "string", example: "UFC 310" },
            location:  { type: "string", example: "T-Mobile Arena, Las Vegas" },
            date:      { type: "string", format: "date-time", example: "2025-12-07T22:00:00Z" },
            posterUrl: { type: "string", example: "https://cdn.example.com/ufc310.jpg" },
            status:    { type: "string", enum: ["UPCOMING", "ONGOING", "COMPLETED", "CANCELLED"] },
          },
        },
        // ── Bout ──────────────────────────────────────────────────────────
        BoutBody: {
          type: "object",
          required: ["eventId", "weightClass", "fighters"],
          properties: {
            eventId:    { type: "string", example: "clxyz123" },
            weightClass: { type: "string", example: "Heavyweight" },
            rounds:     { type: "integer", example: 5 },
            isMainEvent:   { type: "boolean", example: true },
            isCoMainEvent: { type: "boolean", example: false },
            isTitleFight:  { type: "boolean", example: true },
            isChampionVsChampion: { type: "boolean", example: false },
            order:      { type: "integer", example: 1 },
            fighters: {
              type: "array",
              minItems: 2,
              maxItems: 2,
              items: {
                type: "object",
                properties: {
                  fighterId: { type: "string" },
                  corner:    { type: "integer", enum: [1, 2], description: "1 = red, 2 = blue" },
                },
              },
            },
          },
        },
        BoutResultBody: {
          type: "object",
          required: ["winnerId", "result"],
          properties: {
            winnerId: { type: "string", example: "clxyz456" },
            result: {
              type: "string",
              enum: ["KO_TKO", "SUBMISSION", "DECISION_UNANIMOUS", "DECISION_SPLIT", "DECISION_MAJORITY", "DRAW", "NO_CONTEST", "DQ"],
            },
            isFinish: { type: "boolean", example: true },
            isTitleFight: { type: "boolean", example: true },
            isChampionVsChampion: { type: "boolean", example: false },
            isWinnerAgainstRanked: { type: "boolean", example: true },
            isFiveRoundFight: { type: "boolean", example: true },
          },
        },
        // ── League ────────────────────────────────────────────────────────
        LeagueBody: {
          type: "object",
          required: ["name", "leagueType", "draftTime"],
          properties: {
            name:        { type: "string", example: "Champions League" },
            leagueType:  { type: "string", enum: ["PUBLIC", "PRIVATE"] },
            passcode:    { type: "string", example: "secret123", description: "Required if leagueType is PRIVATE" },
            memberLimit: { type: "integer", example: 10, minimum: 2, maximum: 20 },
            rosterSize:  { type: "integer", example: 5, minimum: 1, maximum: 10 },
            draftTime:   { type: "string", format: "date-time", example: "2025-12-08T18:00:00Z" },
            secondsPerPick: { type: "integer", example: 60, minimum: 30, maximum: 300 },
          },
        },
        JoinLeagueBody: {
          type: "object",
          required: ["code", "teamName"],
          properties: {
            code:     { type: "string", example: "ABC123" },
            passcode: { type: "string", example: "secret123" },
            teamName: { type: "string", example: "The Iron Fists" },
          },
        },
        // ── Draft ─────────────────────────────────────────────────────────
        PickFighterBody: {
          type: "object",
          required: ["fighterId"],
          properties: {
            fighterId: { type: "string", example: "clxyz789" },
          },
        },
        // ── Newsletter ────────────────────────────────────────────────────
        NewsletterBody: {
          type: "object",
          required: ["title", "description"],
          properties: {
            title:       { type: "string", example: "Latest UFC Updates" },
            description: { 
              type: "string", 
              description: "Rich text content (HTML) for the newsletter body", 
              example: "<h1>New Fights</h1><p>Check out the latest bout announcements!</p>" 
            },
          },
        },
        // ── Shared ────────────────────────────────────────────────────────
        SuccessResponse: {
          type: "object",
          properties: {
            success:    { type: "boolean", example: true },
            statusCode: { type: "integer", example: 200 },
            message:    { type: "string", example: "Operation successful" },
            data:       { type: "object" },
          },
        },
        PaginatedMeta: {
          type: "object",
          properties: {
            page:      { type: "integer", example: 1 },
            limit:     { type: "integer", example: 10 },
            total:     { type: "integer", example: 100 },
            totalPage: { type: "integer", example: 10 },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            success:    { type: "boolean", example: false },
            statusCode: { type: "integer", example: 400 },
            message:    { type: "string", example: "Validation error" },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ["./src/app/modules/**/*.route.ts"],
};

export const swaggerSpec = swaggerJSDoc(options);
