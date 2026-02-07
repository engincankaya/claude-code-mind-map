#NOTE: This is an old simulation. Server-side artifact store is not implemented yet. 

# MindMap Agent Simulation

> Ben mindmap-agent'ım. Bir NestJS backend projesini analiz ediyorum.
> Elimdeki araçlar: scan, resolve, context, parse, sample, build, validate, publish

---

## PHASE 1: DISCOVERY

### Adım 1.1 — mindmap.scan çağrısı

```
→ CALL: mcp__mindmap__scan
  INPUT: {
    "rootPath": "/Users/dev/my-nestjs-app",
    "ignore": ["node_modules", ".git", "dist", "coverage", "__pycache__"],
    "maxFiles": 10000
  }
```

```
← RESPONSE:
{
  "rootPath": "/Users/dev/my-nestjs-app",
  "files": [
    "src/main.ts",
    "src/app.module.ts",
    "src/app.controller.ts",
    "src/app.service.ts",
    "src/auth/auth.module.ts",
    "src/auth/auth.controller.ts",
    "src/auth/auth.service.ts",
    "src/auth/auth.guard.ts",
    "src/auth/strategies/jwt.strategy.ts",
    "src/auth/strategies/local.strategy.ts",
    "src/auth/dto/login.dto.ts",
    "src/auth/dto/register.dto.ts",
    "src/users/users.module.ts",
    "src/users/users.controller.ts",
    "src/users/users.service.ts",
    "src/users/users.repository.ts",
    "src/users/entities/user.entity.ts",
    "src/users/dto/create-user.dto.ts",
    "src/users/dto/update-user.dto.ts",
    "src/products/products.module.ts",
    "src/products/products.controller.ts",
    "src/products/products.service.ts",
    "src/products/products.repository.ts",
    "src/products/entities/product.entity.ts",
    "src/products/dto/create-product.dto.ts",
    "src/orders/orders.module.ts",
    "src/orders/orders.controller.ts",
    "src/orders/orders.service.ts",
    "src/orders/orders.repository.ts",
    "src/orders/entities/order.entity.ts",
    "src/orders/entities/order-item.entity.ts",
    "src/orders/dto/create-order.dto.ts",
    "src/orders/events/order-created.event.ts",
    "src/orders/listeners/order-created.listener.ts",
    "src/common/decorators/roles.decorator.ts",
    "src/common/decorators/current-user.decorator.ts",
    "src/common/filters/http-exception.filter.ts",
    "src/common/guards/roles.guard.ts",
    "src/common/interceptors/logging.interceptor.ts",
    "src/common/interceptors/transform.interceptor.ts",
    "src/common/pipes/validation.pipe.ts",
    "src/config/database.config.ts",
    "src/config/jwt.config.ts",
    "src/config/app.config.ts",
    "src/database/database.module.ts",
    "src/database/migrations/001-initial.ts",
    "src/database/migrations/002-add-orders.ts",
    "src/database/seeds/user.seed.ts",
    "test/app.e2e-spec.ts",
    "test/auth.e2e-spec.ts",
    "test/jest-e2e.json",
    "package.json",
    "tsconfig.json",
    "tsconfig.build.json",
    "nest-cli.json",
    ".env.example",
    ".eslintrc.js",
    ".prettierrc",
    "README.md",
    "docker-compose.yml",
    "Dockerfile"
  ],
  "stats": {
    "total": 78,
    "included": 56,
    "ignored": 22
  }
}
```

---

### Adım 1.2 — mindmap.resolve çağrısı

```
→ CALL: mcp__mindmap__resolve
  INPUT: {
    "rootPath": "/Users/dev/my-nestjs-app",
    "files": ["src/main.ts", "src/app.module.ts", ... (tüm dosyalar)]
  }
```

```
← RESPONSE:
{
  "rootPath": "/Users/dev/my-nestjs-app",
  "files": [
    {
      "fileId": "a1b2c3d4",
      "absolutePath": "/Users/dev/my-nestjs-app/src/main.ts",
      "canonicalPath": "src/main.ts",
      "contentHash": "sha256:e3b0c44...",
      "ext": ".ts",
      "language": "typescript",
      "sizeBytes": 542
    },
    {
      "fileId": "e5f6g7h8",
      "absolutePath": "/Users/dev/my-nestjs-app/src/app.module.ts",
      "canonicalPath": "src/app.module.ts",
      "contentHash": "sha256:d7a8b9c...",
      "ext": ".ts",
      "language": "typescript",
      "sizeBytes": 1205
    },
    {
      "fileId": "i9j0k1l2",
      "absolutePath": "/Users/dev/my-nestjs-app/src/auth/auth.service.ts",
      "canonicalPath": "src/auth/auth.service.ts",
      "contentHash": "sha256:f1e2d3c...",
      "ext": ".ts",
      "language": "typescript",
      "sizeBytes": 3421
    }
    // ... (56 dosya için benzer çıktılar)
  ]
}
```

---

### Adım 1.3 — mindmap.context çağrısı

```
→ CALL: mcp__mindmap__context
  INPUT: {
    "rootPath": "/Users/dev/my-nestjs-app"
  }
```

```
← RESPONSE:
{
  "rootPath": "/Users/dev/my-nestjs-app",
  "projectFiles": {
    "readme": "# My NestJS E-Commerce API\n\nA REST API for e-commerce platform built with NestJS, TypeORM, and PostgreSQL.\n\n## Features\n- JWT Authentication\n- Role-based access control\n- Product catalog management\n- Order processing with event-driven notifications\n\n## Getting Started\nnpm install\nnpm run start:dev\n...",
    "packageManagers": [
      {
        "type": "npm",
        "filePath": "package.json",
        "name": "my-nestjs-app",
        "dependencies": [
          "@nestjs/common", "@nestjs/core", "@nestjs/platform-express",
          "@nestjs/typeorm", "@nestjs/jwt", "@nestjs/passport",
          "@nestjs/event-emitter", "typeorm", "pg", "bcrypt",
          "class-validator", "class-transformer", "passport",
          "passport-jwt", "passport-local"
        ],
        "scripts": {
          "start": "nest start",
          "start:dev": "nest start --watch",
          "build": "nest build",
          "test": "jest",
          "test:e2e": "jest --config ./test/jest-e2e.json",
          "migration:run": "typeorm migration:run"
        }
      }
    ],
    "configs": [
      { "filePath": "tsconfig.json", "type": "tsconfig", "summary": "TypeScript config with strict mode, ES2021 target" },
      { "filePath": "nest-cli.json", "type": "other", "summary": "NestJS CLI config, sourceRoot: src" },
      { "filePath": ".eslintrc.js", "type": "eslint", "summary": "ESLint with @typescript-eslint/recommended" },
      { "filePath": "docker-compose.yml", "type": "docker", "summary": "PostgreSQL + Redis services" },
      { "filePath": "Dockerfile", "type": "docker", "summary": "Multi-stage Node 18 build" }
    ],
    "entryPoints": ["src/main.ts"]
  },
  "folderStructure": {
    "topLevelDirs": ["src", "test"],
    "maxDepth": 4,
    "totalDirs": 18
  },
  "repoMeta": {
    "primaryLanguages": [
      { "language": "typescript", "fileCount": 48, "percentage": 85.7 },
      { "language": "json", "fileCount": 5, "percentage": 8.9 },
      { "language": "yaml", "fileCount": 2, "percentage": 3.6 }
    ],
    "totalFiles": 56,
    "totalSizeBytes": 142850
  }
}
```

---

### 🧠 LLM YORUMU (Phase 1 sonrası)

Şu an bildiklerim:
- **Framework**: NestJS (modüler yapı)
- **Database**: TypeORM + PostgreSQL
- **Auth**: JWT + Passport
- **Event system**: @nestjs/event-emitter (event-driven patterns var!)
- **Domains**: Auth, Users, Products, Orders
- **Pattern**: NestJS standard modüler yapı (module + controller + service + repository)
- **İlginç**: Event-driven order processing var — bu import graph'ta görünmeyebilir

56 dosya var — çok büyük değil, summary + standard parse yeterli olacak.

---

## PHASE 2: EXTRACTION

### Adım 2.1 — mindmap.parse (summary) — TÜM dosyalar

```
→ CALL: mcp__mindmap__parse
  INPUT: {
    "rootPath": "/Users/dev/my-nestjs-app",
    "files": [ ... (tüm 48 TS dosyası) ... ],
    "depth": "summary"
  }
```

```
← RESPONSE:
{
  "rootPath": "/Users/dev/my-nestjs-app",
  "files": [
    {
      "fileId": "a1b2c3d4",
      "canonicalPath": "src/main.ts",
      "language": "typescript",
      "stats": { "lines": 22, "importCount": 3, "exportCount": 0, "symbolCount": 1, "symbolKinds": { "function": 1 } }
    },
    {
      "fileId": "e5f6g7h8",
      "canonicalPath": "src/app.module.ts",
      "language": "typescript",
      "stats": { "lines": 35, "importCount": 6, "exportCount": 1, "symbolCount": 1, "symbolKinds": { "class": 1 } }
    },
    {
      "fileId": "i9j0k1l2",
      "canonicalPath": "src/auth/auth.service.ts",
      "language": "typescript",
      "stats": { "lines": 98, "importCount": 8, "exportCount": 1, "symbolCount": 1, "symbolKinds": { "class": 1 } }
    },
    {
      "fileId": "m3n4o5p6",
      "canonicalPath": "src/auth/auth.guard.ts",
      "language": "typescript",
      "stats": { "lines": 25, "importCount": 3, "exportCount": 1, "symbolCount": 1, "symbolKinds": { "class": 1 } }
    },
    {
      "fileId": "q7r8s9t0",
      "canonicalPath": "src/orders/orders.service.ts",
      "language": "typescript",
      "stats": { "lines": 145, "importCount": 10, "exportCount": 1, "symbolCount": 1, "symbolKinds": { "class": 1 } }
    },
    {
      "fileId": "u1v2w3x4",
      "canonicalPath": "src/orders/events/order-created.event.ts",
      "language": "typescript",
      "stats": { "lines": 12, "importCount": 0, "exportCount": 1, "symbolCount": 1, "symbolKinds": { "class": 1 } }
    },
    {
      "fileId": "y5z6a7b8",
      "canonicalPath": "src/orders/listeners/order-created.listener.ts",
      "language": "typescript",
      "stats": { "lines": 35, "importCount": 5, "exportCount": 1, "symbolCount": 1, "symbolKinds": { "class": 1 } }
    },
    {
      "fileId": "c9d0e1f2",
      "canonicalPath": "src/common/guards/roles.guard.ts",
      "language": "typescript",
      "stats": { "lines": 30, "importCount": 4, "exportCount": 1, "symbolCount": 1, "symbolKinds": { "class": 1 } }
    },
    {
      "fileId": "g3h4i5j6",
      "canonicalPath": "src/common/decorators/roles.decorator.ts",
      "language": "typescript",
      "stats": { "lines": 8, "importCount": 1, "exportCount": 1, "symbolCount": 1, "symbolKinds": { "function": 1 } }
    },
    {
      "fileId": "k7l8m9n0",
      "canonicalPath": "src/config/database.config.ts",
      "language": "typescript",
      "stats": { "lines": 20, "importCount": 2, "exportCount": 1, "symbolCount": 1, "symbolKinds": { "function": 1 } }
    },
    {
      "fileId": "o1p2q3r4",
      "canonicalPath": "src/users/entities/user.entity.ts",
      "language": "typescript",
      "stats": { "lines": 45, "importCount": 3, "exportCount": 1, "symbolCount": 1, "symbolKinds": { "class": 1 } }
    },
    {
      "fileId": "dto_login",
      "canonicalPath": "src/auth/dto/login.dto.ts",
      "language": "typescript",
      "stats": { "lines": 12, "importCount": 2, "exportCount": 1, "symbolCount": 1, "symbolKinds": { "class": 1 } }
    },
    {
      "fileId": "mig_001",
      "canonicalPath": "src/database/migrations/001-initial.ts",
      "language": "typescript",
      "stats": { "lines": 55, "importCount": 1, "exportCount": 1, "symbolCount": 1, "symbolKinds": { "class": 1 } }
    }
    // ... (48 dosyanın hepsi)
  ],
  "unresolvedImports": [],
  "parserMeta": {
    "treeSitterVersion": "0.22.0",
    "languagesUsed": ["typescript"],
    "parseErrors": []
  }
}
```

---

### 🧠 LLM YORUMU (Summary sonrası)

Summary'den anlıyorum ki:
- **Yüksek import sayılı dosyalar**: `orders.service.ts` (10 import), `auth.service.ts` (8 import) — bunlar muhtemelen core dosyalar
- **Entry point**: `main.ts` (3 import, 1 function — bootstrap)
- **Module hub**: `app.module.ts` (6 import — tüm modülleri topluyor)
- **Event system**: `order-created.event.ts` (0 import) ve `order-created.listener.ts` (5 import) — event-driven pattern
- **Small files**: DTO'lar, decorators, configs — genelde 8-20 satır

Şimdi **core dosyalar** için detailed parse isteyeceğim:
- Entry point: `main.ts`
- Module hub: `app.module.ts`
- Core services: `auth.service.ts`, `orders.service.ts`, `users.service.ts`, `products.service.ts`
- Event files: `order-created.event.ts`, `order-created.listener.ts`
- Guards: `auth.guard.ts`, `roles.guard.ts`

---

### Adım 2.2 — mindmap.parse (standard) — core dosyalar

```
→ CALL: mcp__mindmap__parse
  INPUT: {
    "rootPath": "/Users/dev/my-nestjs-app",
    "files": [
      { "fileId": "e5f6g7h8", "absolutePath": "/.../src/app.module.ts", "canonicalPath": "src/app.module.ts", "language": "typescript" },
      { "fileId": "i9j0k1l2", "absolutePath": "/.../src/auth/auth.service.ts", "canonicalPath": "src/auth/auth.service.ts", "language": "typescript" },
      { "fileId": "q7r8s9t0", "absolutePath": "/.../src/orders/orders.service.ts", "canonicalPath": "src/orders/orders.service.ts", "language": "typescript" },
      { "fileId": "y5z6a7b8", "absolutePath": "/.../src/orders/listeners/order-created.listener.ts", "canonicalPath": "src/orders/listeners/order-created.listener.ts", "language": "typescript" },
      { "fileId": "c9d0e1f2", "absolutePath": "/.../src/common/guards/roles.guard.ts", "canonicalPath": "src/common/guards/roles.guard.ts", "language": "typescript" }
    ],
    "depth": "standard"
  }
```

```
← RESPONSE:
{
  "rootPath": "/Users/dev/my-nestjs-app",
  "files": [
    {
      "fileId": "e5f6g7h8",
      "canonicalPath": "src/app.module.ts",
      "language": "typescript",
      "imports": [
        { "rawSpecifier": "@nestjs/common", "kind": "static", "importedSymbols": ["Module"], "resolvedTargetFileId": null },
        { "rawSpecifier": "./auth/auth.module", "kind": "static", "importedSymbols": ["AuthModule"], "resolvedTargetFileId": "auth_mod_id" },
        { "rawSpecifier": "./users/users.module", "kind": "static", "importedSymbols": ["UsersModule"], "resolvedTargetFileId": "users_mod_id" },
        { "rawSpecifier": "./products/products.module", "kind": "static", "importedSymbols": ["ProductsModule"], "resolvedTargetFileId": "products_mod_id" },
        { "rawSpecifier": "./orders/orders.module", "kind": "static", "importedSymbols": ["OrdersModule"], "resolvedTargetFileId": "orders_mod_id" },
        { "rawSpecifier": "./database/database.module", "kind": "static", "importedSymbols": ["DatabaseModule"], "resolvedTargetFileId": "db_mod_id" }
      ],
      "exports": [
        { "kind": "named", "exportedSymbols": ["AppModule"] }
      ],
      "symbols": [
        { "symbolId": "sym_appmodule", "kind": "class", "name": "AppModule", "visibility": "public", "evidence": { "startLine": 12, "endLine": 35 } }
      ]
    },
    {
      "fileId": "i9j0k1l2",
      "canonicalPath": "src/auth/auth.service.ts",
      "language": "typescript",
      "imports": [
        { "rawSpecifier": "@nestjs/common", "kind": "static", "importedSymbols": ["Injectable", "UnauthorizedException"], "resolvedTargetFileId": null },
        { "rawSpecifier": "@nestjs/jwt", "kind": "static", "importedSymbols": ["JwtService"], "resolvedTargetFileId": null },
        { "rawSpecifier": "../users/users.service", "kind": "static", "importedSymbols": ["UsersService"], "resolvedTargetFileId": "users_svc_id" },
        { "rawSpecifier": "bcrypt", "kind": "static", "importedSymbols": ["*"], "resolvedTargetFileId": null },
        { "rawSpecifier": "./dto/login.dto", "kind": "static", "importedSymbols": ["LoginDto"], "resolvedTargetFileId": "dto_login" },
        { "rawSpecifier": "./dto/register.dto", "kind": "static", "importedSymbols": ["RegisterDto"], "resolvedTargetFileId": "dto_register" },
        { "rawSpecifier": "../users/entities/user.entity", "kind": "static", "importedSymbols": ["User"], "resolvedTargetFileId": "user_entity_id" },
        { "rawSpecifier": "../config/jwt.config", "kind": "static", "importedSymbols": ["jwtConfig"], "resolvedTargetFileId": "jwt_config_id" }
      ],
      "exports": [
        { "kind": "named", "exportedSymbols": ["AuthService"] }
      ],
      "symbols": [
        { "symbolId": "sym_authsvc", "kind": "class", "name": "AuthService", "visibility": "public", "evidence": { "startLine": 10, "endLine": 98 } }
      ]
    },
    {
      "fileId": "q7r8s9t0",
      "canonicalPath": "src/orders/orders.service.ts",
      "language": "typescript",
      "imports": [
        { "rawSpecifier": "@nestjs/common", "kind": "static", "importedSymbols": ["Injectable", "NotFoundException"], "resolvedTargetFileId": null },
        { "rawSpecifier": "@nestjs/event-emitter", "kind": "static", "importedSymbols": ["EventEmitter2"], "resolvedTargetFileId": null },
        { "rawSpecifier": "./orders.repository", "kind": "static", "importedSymbols": ["OrdersRepository"], "resolvedTargetFileId": "orders_repo_id" },
        { "rawSpecifier": "../products/products.service", "kind": "static", "importedSymbols": ["ProductsService"], "resolvedTargetFileId": "products_svc_id" },
        { "rawSpecifier": "./entities/order.entity", "kind": "static", "importedSymbols": ["Order"], "resolvedTargetFileId": "order_entity_id" },
        { "rawSpecifier": "./entities/order-item.entity", "kind": "static", "importedSymbols": ["OrderItem"], "resolvedTargetFileId": "order_item_id" },
        { "rawSpecifier": "./dto/create-order.dto", "kind": "static", "importedSymbols": ["CreateOrderDto"], "resolvedTargetFileId": "create_order_dto" },
        { "rawSpecifier": "./events/order-created.event", "kind": "static", "importedSymbols": ["OrderCreatedEvent"], "resolvedTargetFileId": "u1v2w3x4" },
        { "rawSpecifier": "../users/entities/user.entity", "kind": "static", "importedSymbols": ["User"], "resolvedTargetFileId": "user_entity_id" },
        { "rawSpecifier": "typeorm", "kind": "static", "importedSymbols": ["DataSource"], "resolvedTargetFileId": null }
      ],
      "exports": [
        { "kind": "named", "exportedSymbols": ["OrdersService"] }
      ],
      "symbols": [
        { "symbolId": "sym_ordersvc", "kind": "class", "name": "OrdersService", "visibility": "public", "evidence": { "startLine": 15, "endLine": 145 } }
      ]
    },
    {
      "fileId": "y5z6a7b8",
      "canonicalPath": "src/orders/listeners/order-created.listener.ts",
      "language": "typescript",
      "imports": [
        { "rawSpecifier": "@nestjs/event-emitter", "kind": "static", "importedSymbols": ["OnEvent"], "resolvedTargetFileId": null },
        { "rawSpecifier": "@nestjs/common", "kind": "static", "importedSymbols": ["Injectable", "Logger"], "resolvedTargetFileId": null },
        { "rawSpecifier": "../events/order-created.event", "kind": "static", "importedSymbols": ["OrderCreatedEvent"], "resolvedTargetFileId": "u1v2w3x4" },
        { "rawSpecifier": "../../users/users.service", "kind": "static", "importedSymbols": ["UsersService"], "resolvedTargetFileId": "users_svc_id" },
        { "rawSpecifier": "@nestjs/mailer", "kind": "static", "importedSymbols": ["MailerService"], "resolvedTargetFileId": null }
      ],
      "exports": [
        { "kind": "named", "exportedSymbols": ["OrderCreatedListener"] }
      ],
      "symbols": [
        { "symbolId": "sym_orderlistener", "kind": "class", "name": "OrderCreatedListener", "visibility": "public", "evidence": { "startLine": 8, "endLine": 35 } }
      ]
    },
    {
      "fileId": "c9d0e1f2",
      "canonicalPath": "src/common/guards/roles.guard.ts",
      "language": "typescript",
      "imports": [
        { "rawSpecifier": "@nestjs/common", "kind": "static", "importedSymbols": ["Injectable", "CanActivate", "ExecutionContext"], "resolvedTargetFileId": null },
        { "rawSpecifier": "@nestjs/core", "kind": "static", "importedSymbols": ["Reflector"], "resolvedTargetFileId": null },
        { "rawSpecifier": "../decorators/roles.decorator", "kind": "static", "importedSymbols": ["ROLES_KEY"], "resolvedTargetFileId": "g3h4i5j6" },
        { "rawSpecifier": "../../users/entities/user.entity", "kind": "static", "importedSymbols": ["UserRole"], "resolvedTargetFileId": "user_entity_id" }
      ],
      "exports": [
        { "kind": "named", "exportedSymbols": ["RolesGuard"] }
      ],
      "symbols": [
        { "symbolId": "sym_rolesguard", "kind": "class", "name": "RolesGuard", "visibility": "public", "evidence": { "startLine": 8, "endLine": 30 } }
      ]
    }
  ],
  "unresolvedImports": [],
  "parserMeta": { "treeSitterVersion": "0.22.0", "languagesUsed": ["typescript"], "parseErrors": [] }
}
```

---

### 🧠 LLM YORUMU (Standard parse sonrası)

Artık import graph'ı görüyorum. Kritik keşifler:

1. **OrdersService → EventEmitter2** kullanıyor ve `OrderCreatedEvent` emit ediyor
2. **OrderCreatedListener** bu event'i dinliyor, `UsersService` ve `MailerService` kullanıyor
3. Bu **event-driven ilişki** import graph'ta dolaylı görünüyor ama gerçekte:
   `OrdersService --emits_event--> OrderCreatedEvent --listens_event--> OrderCreatedListener`
4. **AuthService → UsersService** cross-domain dependency var
5. **RolesGuard → roles.decorator** birlikte çalışıyor (guard + decorator pattern)
6. **AppModule** tüm modülleri topluyor — hub

Ama `OrdersService`'in EventEmitter2'yi nasıl kullandığını görmem lazım. Sample isteyeceğim.

---

### Adım 2.3 — mindmap.sample (belirsiz durumlar için)

```
→ CALL: mcp__mindmap__sample
  INPUT: {
    "rootPath": "/Users/dev/my-nestjs-app",
    "fileId": "q7r8s9t0",
    "absolutePath": "/Users/dev/my-nestjs-app/src/orders/orders.service.ts",
    "startLine": 50,
    "endLine": 90
  }
```

```
← RESPONSE:
{
  "fileId": "q7r8s9t0",
  "canonicalPath": "src/orders/orders.service.ts",
  "language": "typescript",
  "content": "  async createOrder(user: User, createOrderDto: CreateOrderDto): Promise<Order> {\n    const items = await Promise.all(\n      createOrderDto.items.map(async (item) => {\n        const product = await this.productsService.findOne(item.productId);\n        if (!product) throw new NotFoundException(`Product ${item.productId} not found`);\n        return this.createOrderItem(product, item.quantity);\n      })\n    );\n\n    const order = this.ordersRepository.create({\n      user,\n      items,\n      totalAmount: items.reduce((sum, item) => sum + item.subtotal, 0),\n      status: 'pending',\n    });\n\n    const savedOrder = await this.ordersRepository.save(order);\n\n    // Emit event for async processing (email notification, inventory update)\n    this.eventEmitter.emit(\n      'order.created',\n      new OrderCreatedEvent(savedOrder.id, user.id, savedOrder.totalAmount)\n    );\n\n    return savedOrder;\n  }\n\n  async findAllByUser(userId: string): Promise<Order[]> {\n    return this.ordersRepository.find({\n      where: { user: { id: userId } },\n      relations: ['items', 'items.product'],\n      order: { createdAt: 'DESC' },\n    });\n  }",
  "totalLines": 145,
  "range": { "startLine": 50, "endLine": 90 }
}
```

---

### 🧠 LLM YORUMU (Sample sonrası)

Mükemmel! Şimdi net görüyorum:
- `OrdersService.createOrder()` → `this.eventEmitter.emit('order.created', new OrderCreatedEvent(...))`
- Bu bir **asenkron event-driven pattern**. OrderCreatedListener bu event'i yakalar ve:
  - Kullanıcıya email gönderir (MailerService)
  - Stok günceller

Bu ilişki import graph'ta **görünmüyor** çünkü EventEmitter2 runtime dispatch yapıyor. Ben bunu ArchitecturePlan'da `additionalRelationships` olarak eklemeliyim.

---

## PHASE 3: INTERPRETATION (LLM'in Ana İşi)

Topladığım tüm verileri analiz ediyorum ve **ArchitecturePlan** üretiyorum:

```json
{
  "version": "2",

  "architecture": {
    "pattern": "NestJS Modular Architecture with Event-Driven Processing",
    "description": "E-commerce REST API using NestJS module system with domain-based grouping. Uses TypeORM for persistence, JWT/Passport for auth, and EventEmitter2 for async order processing workflows.",
    "primaryLanguage": "typescript",
    "frameworks": ["NestJS", "TypeORM", "Passport", "EventEmitter2"]
  },

  "view": "domain_then_layer",

  "groups": [
    {
      "groupId": "grp_root",
      "label": "My NestJS E-Commerce API",
      "kind": "other",
      "description": "Root application"
    },
    {
      "groupId": "grp_auth",
      "label": "Authentication & Authorization",
      "kind": "domain",
      "parentGroupId": "grp_root",
      "description": "JWT-based authentication, local strategy, role-based access control",
      "matchRules": [
        { "type": "canonicalPathContains", "value": "src/auth/" },
        { "type": "canonicalPathContains", "value": "src/common/guards/" },
        { "type": "canonicalPathContains", "value": "src/common/decorators/roles" },
        { "type": "canonicalPathContains", "value": "src/common/decorators/current-user" }
      ]
    },
    {
      "groupId": "grp_users",
      "label": "User Management",
      "kind": "domain",
      "parentGroupId": "grp_root",
      "description": "CRUD operations for user accounts",
      "matchRules": [
        { "type": "canonicalPathContains", "value": "src/users/" }
      ]
    },
    {
      "groupId": "grp_products",
      "label": "Product Catalog",
      "kind": "domain",
      "parentGroupId": "grp_root",
      "description": "Product management and catalog",
      "matchRules": [
        { "type": "canonicalPathContains", "value": "src/products/" }
      ]
    },
    {
      "groupId": "grp_orders",
      "label": "Order Processing",
      "kind": "domain",
      "parentGroupId": "grp_root",
      "description": "Order creation, management, and event-driven async processing",
      "matchRules": [
        { "type": "canonicalPathContains", "value": "src/orders/" }
      ]
    },
    {
      "groupId": "grp_infra",
      "label": "Infrastructure",
      "kind": "infrastructure",
      "parentGroupId": "grp_root",
      "description": "Cross-cutting concerns: database, config, common utilities",
      "matchRules": [
        { "type": "canonicalPathContains", "value": "src/common/" },
        { "type": "canonicalPathContains", "value": "src/config/" },
        { "type": "canonicalPathContains", "value": "src/database/" }
      ]
    },
    {
      "groupId": "grp_tests",
      "label": "Tests",
      "kind": "other",
      "parentGroupId": "grp_root",
      "matchRules": [
        { "type": "canonicalPathContains", "value": "test/" }
      ]
    }
  ],

  "classifications": [
    { "fileId": "a1b2c3d4", "canonicalPath": "src/main.ts", "role": "entry-point", "parentGroupId": "grp_root", "importance": "core", "confidence": 1.0 },
    { "fileId": "e5f6g7h8", "canonicalPath": "src/app.module.ts", "role": "module-hub", "parentGroupId": "grp_root", "importance": "core", "confidence": 1.0 },

    { "fileId": "i9j0k1l2", "canonicalPath": "src/auth/auth.service.ts", "role": "service", "parentGroupId": "grp_auth", "importance": "core", "confidence": 0.95 },
    { "fileId": "m3n4o5p6", "canonicalPath": "src/auth/auth.guard.ts", "role": "guard", "parentGroupId": "grp_auth", "importance": "core", "confidence": 0.95 },
    { "fileId": "auth_ctrl",  "canonicalPath": "src/auth/auth.controller.ts", "role": "controller", "parentGroupId": "grp_auth", "importance": "core", "confidence": 0.95 },
    { "fileId": "jwt_strat",  "canonicalPath": "src/auth/strategies/jwt.strategy.ts", "role": "strategy", "parentGroupId": "grp_auth", "importance": "supporting", "confidence": 0.90 },
    { "fileId": "local_strat", "canonicalPath": "src/auth/strategies/local.strategy.ts", "role": "strategy", "parentGroupId": "grp_auth", "importance": "supporting", "confidence": 0.90 },
    { "fileId": "dto_login",  "canonicalPath": "src/auth/dto/login.dto.ts", "role": "dto", "parentGroupId": "grp_auth", "importance": "peripheral", "confidence": 1.0 },
    { "fileId": "dto_register", "canonicalPath": "src/auth/dto/register.dto.ts", "role": "dto", "parentGroupId": "grp_auth", "importance": "peripheral", "confidence": 1.0 },

    { "fileId": "users_svc_id", "canonicalPath": "src/users/users.service.ts", "role": "service", "parentGroupId": "grp_users", "importance": "core", "confidence": 0.95 },
    { "fileId": "users_ctrl",  "canonicalPath": "src/users/users.controller.ts", "role": "controller", "parentGroupId": "grp_users", "importance": "core", "confidence": 0.95 },
    { "fileId": "users_repo",  "canonicalPath": "src/users/users.repository.ts", "role": "repository", "parentGroupId": "grp_users", "importance": "supporting", "confidence": 0.90 },
    { "fileId": "user_entity_id", "canonicalPath": "src/users/entities/user.entity.ts", "role": "entity", "parentGroupId": "grp_users", "importance": "core", "confidence": 1.0 },

    { "fileId": "products_svc_id", "canonicalPath": "src/products/products.service.ts", "role": "service", "parentGroupId": "grp_products", "importance": "core", "confidence": 0.95 },
    { "fileId": "product_entity", "canonicalPath": "src/products/entities/product.entity.ts", "role": "entity", "parentGroupId": "grp_products", "importance": "core", "confidence": 1.0 },

    { "fileId": "q7r8s9t0", "canonicalPath": "src/orders/orders.service.ts", "role": "service", "parentGroupId": "grp_orders", "importance": "core", "confidence": 0.95 },
    { "fileId": "u1v2w3x4", "canonicalPath": "src/orders/events/order-created.event.ts", "role": "event", "parentGroupId": "grp_orders", "importance": "supporting", "confidence": 0.90 },
    { "fileId": "y5z6a7b8", "canonicalPath": "src/orders/listeners/order-created.listener.ts", "role": "event-listener", "parentGroupId": "grp_orders", "importance": "supporting", "confidence": 0.90 },

    { "fileId": "c9d0e1f2", "canonicalPath": "src/common/guards/roles.guard.ts", "role": "guard", "parentGroupId": "grp_auth", "importance": "core", "confidence": 0.85,
      "reasoning": "RolesGuard is auth-related even though it lives in common/. It uses ROLES_KEY decorator and checks user roles." },

    { "fileId": "k7l8m9n0", "canonicalPath": "src/config/database.config.ts", "role": "config", "parentGroupId": "grp_infra", "importance": "supporting", "confidence": 1.0 },
    { "fileId": "mig_001", "canonicalPath": "src/database/migrations/001-initial.ts", "role": "migration", "parentGroupId": "grp_infra", "importance": "peripheral", "confidence": 1.0 }
  ],

  "additionalRelationships": [
    {
      "sourceFileId": "q7r8s9t0",
      "targetFileId": "y5z6a7b8",
      "rels": ["emits_event"],
      "annotation": "OrdersService emits 'order.created' event via EventEmitter2, which OrderCreatedListener handles asynchronously for email notifications and inventory updates",
      "confidence": 0.95
    },
    {
      "sourceFileId": "c9d0e1f2",
      "targetFileId": "g3h4i5j6",
      "rels": ["conceptual"],
      "annotation": "RolesGuard reads metadata set by @Roles() decorator. They work as a pair for role-based access control.",
      "confidence": 0.95
    },
    {
      "sourceFileId": "m3n4o5p6",
      "targetFileId": "auth_ctrl",
      "rels": ["conceptual"],
      "annotation": "AuthGuard is applied to controllers via @UseGuards() decorator — not visible in direct imports but critical for auth flow.",
      "confidence": 0.85
    }
  ],

  "edgePolicy": {
    "aggregation": true,
    "relPriority": ["imports", "emits_event", "listens_event", "extends", "implements", "injects", "calls", "conceptual"],
    "hideWeakEdges": true,
    "weakEdgeThreshold": 0.3
  },

  "exclusions": {
    "globs": [".eslintrc.js", ".prettierrc", "*.json", "docker-compose.yml", "Dockerfile", ".env.example"],
    "reasons": ["Config/infra files not architecturally significant for mind map"]
  },

  "collapseRules": [
    {
      "when": { "importance": "peripheral", "groupKind": "other" },
      "action": "collapse",
      "label": "DTOs & Config"
    },
    {
      "when": { "groupKind": "other", "fileCount": { "gt": 5 } },
      "action": "collapse",
      "label": "Tests"
    }
  ]
}
```

---

## PHASE 4: CONSTRUCTION

### Adım 4 — mindmap.build çağrısı

```
→ CALL: mcp__mindmap__build
  INPUT: {
    "plan": (yukarıdaki ArchitecturePlan),
    "analysis": (parse sonuçları),
    "resolvedFiles": (resolve sonuçları),
    "policy": {
      "edgeAggregation": true,
      "maxDepth": 3,
      "includeSymbolNodes": false
    }
  }
```

```
← RESPONSE (MindMapJSON):
{
  "meta": {
    "generatedAt": "2026-02-07T12:30:00Z",
    "rootPath": "/Users/dev/my-nestjs-app",
    "view": "domain_then_layer",
    "nodeCount": 28,
    "edgeCount": 22,
    "toolVersions": { "mcpServer": "1.0.0", "treeSitter": "0.22.0" }
  },
  "nodes": [
    {
      "id": "node_root",
      "label": "My NestJS E-Commerce API",
      "kind": "root",
      "type": "application",
      "metadata": {},
      "confidence": 1.0,
      "evidence": { "reason": "Project root" }
    },
    {
      "id": "node_grp_auth",
      "label": "Authentication & Authorization",
      "kind": "group",
      "type": "domain",
      "parentId": "node_root",
      "metadata": {},
      "style": { "icon": "shield", "color": "#e74c3c" },
      "confidence": 0.95,
      "evidence": { "reason": "JWT + Passport + RBAC domain" }
    },
    {
      "id": "node_auth_svc",
      "label": "AuthService",
      "kind": "file",
      "type": "service",
      "parentId": "node_grp_auth",
      "metadata": { "canonicalPath": "src/auth/auth.service.ts", "fileId": "i9j0k1l2", "role": "service", "importance": "core" },
      "confidence": 0.95,
      "evidence": { "startLine": 10, "endLine": 98, "reason": "Core authentication logic" }
    },
    {
      "id": "node_auth_guard",
      "label": "AuthGuard",
      "kind": "file",
      "type": "guard",
      "parentId": "node_grp_auth",
      "metadata": { "canonicalPath": "src/auth/auth.guard.ts", "fileId": "m3n4o5p6" },
      "confidence": 0.95,
      "evidence": { "startLine": 1, "endLine": 25, "reason": "JWT authentication guard" }
    },
    {
      "id": "node_roles_guard",
      "label": "RolesGuard",
      "kind": "file",
      "type": "guard",
      "parentId": "node_grp_auth",
      "metadata": { "canonicalPath": "src/common/guards/roles.guard.ts", "fileId": "c9d0e1f2" },
      "confidence": 0.85,
      "evidence": { "startLine": 8, "endLine": 30, "reason": "Role-based access control guard" }
    },
    {
      "id": "node_grp_orders",
      "label": "Order Processing",
      "kind": "group",
      "type": "domain",
      "parentId": "node_root",
      "metadata": {},
      "style": { "icon": "shopping-cart", "color": "#3498db" },
      "confidence": 0.95,
      "evidence": { "reason": "Order domain with event-driven async processing" }
    },
    {
      "id": "node_orders_svc",
      "label": "OrdersService",
      "kind": "file",
      "type": "service",
      "parentId": "node_grp_orders",
      "metadata": { "canonicalPath": "src/orders/orders.service.ts", "fileId": "q7r8s9t0", "importance": "core" },
      "confidence": 0.95,
      "evidence": { "startLine": 15, "endLine": 145, "reason": "Core order business logic with event emission" }
    },
    {
      "id": "node_order_listener",
      "label": "OrderCreatedListener",
      "kind": "file",
      "type": "event-listener",
      "parentId": "node_grp_orders",
      "metadata": { "canonicalPath": "src/orders/listeners/order-created.listener.ts", "fileId": "y5z6a7b8" },
      "confidence": 0.90,
      "evidence": { "startLine": 8, "endLine": 35, "reason": "Handles order.created event for notifications" }
    },
    {
      "id": "node_grp_users",
      "label": "User Management",
      "kind": "group",
      "type": "domain",
      "parentId": "node_root",
      "style": { "icon": "users", "color": "#2ecc71" },
      "confidence": 0.95
    },
    {
      "id": "node_grp_products",
      "label": "Product Catalog",
      "kind": "group",
      "type": "domain",
      "parentId": "node_root",
      "style": { "icon": "box", "color": "#f39c12" },
      "confidence": 0.95
    },
    {
      "id": "node_grp_infra",
      "label": "Infrastructure",
      "kind": "group",
      "type": "infrastructure",
      "parentId": "node_root",
      "style": { "icon": "settings", "color": "#95a5a6" },
      "confidence": 1.0
    }
    // ... (toplam 28 node)
  ],
  "edges": [
    {
      "id": "edge_auth_users",
      "source": "node_auth_svc",
      "target": "node_users_svc",
      "rels": ["imports", "injects"],
      "label": "AuthService → UsersService",
      "metadata": { "importedSymbols": ["UsersService"], "annotation": "DI injection for user lookup during authentication" },
      "confidence": 0.95,
      "evidence": { "startLine": 4, "endLine": 4, "reason": "import { UsersService }" }
    },
    {
      "id": "edge_orders_products",
      "source": "node_orders_svc",
      "target": "node_products_svc",
      "rels": ["imports", "calls"],
      "label": "OrdersService → ProductsService",
      "metadata": { "importedSymbols": ["ProductsService"] },
      "confidence": 0.95,
      "evidence": { "startLine": 5, "endLine": 5, "reason": "import for product validation during order creation" }
    },
    {
      "id": "edge_orders_event",
      "source": "node_orders_svc",
      "target": "node_order_listener",
      "rels": ["emits_event"],
      "label": "emits order.created",
      "metadata": { "annotation": "EventEmitter2 async event: order.created → email notification + inventory" },
      "confidence": 0.95,
      "evidence": { "startLine": 72, "endLine": 75, "reason": "this.eventEmitter.emit('order.created', ...)" }
    },
    {
      "id": "edge_listener_users",
      "source": "node_order_listener",
      "target": "node_users_svc",
      "rels": ["imports"],
      "label": "OrderCreatedListener → UsersService",
      "metadata": { "importedSymbols": ["UsersService"] },
      "confidence": 0.90,
      "evidence": { "reason": "Fetches user email for notification" }
    },
    {
      "id": "edge_roles_guard_decorator",
      "source": "node_roles_guard",
      "target": "node_roles_decorator",
      "rels": ["imports", "conceptual"],
      "label": "RolesGuard ↔ @Roles()",
      "metadata": { "annotation": "Guard reads ROLES_KEY metadata set by decorator" },
      "confidence": 0.95
    },
    {
      "id": "edge_appmodule_all",
      "source": "node_appmodule",
      "target": "node_grp_auth",
      "rels": ["imports"],
      "label": "AppModule imports AuthModule",
      "confidence": 1.0
    }
    // ... (toplam 22 edge)
  ]
}
```

---

## PHASE 5: VALIDATION

### Adım 5 — mindmap.validate çağrısı

```
→ CALL: mcp__mindmap__validate
  INPUT: {
    "mindmap": (yukarıdaki MindMapJSON)
  }
```

```
← RESPONSE:
{
  "isValid": true,
  "errors": [],
  "warnings": [
    {
      "type": "warning",
      "code": "LOW_CONFIDENCE",
      "message": "Node 'node_roles_guard' has confidence 0.85 (parentGroupId moved from infra to auth)",
      "location": "node_roles_guard"
    },
    {
      "type": "warning",
      "code": "UNCONNECTED_SUBGRAPH",
      "message": "Group 'Tests' has no edges connecting to other groups",
      "location": "node_grp_tests"
    }
  ],
  "stats": {
    "totalNodes": 28,
    "totalEdges": 22,
    "orphanNodes": 0,
    "brokenEdges": 0,
    "parentCycles": 0,
    "maxDepth": 3,
    "avgEdgesPerNode": 1.57,
    "connectedComponents": 2
  },
  "repairHints": []
}
```

### 🧠 LLM YORUMU (Validation sonrası)

Graf geçerli! (isValid: true)

İki uyarı var:
1. `RolesGuard` confidence 0.85 — kabul edilebilir. Common/ dizininde yaşıyor ama mantıksal olarak Auth grubuna ait. Kararımdan eminim.
2. Tests grubu bağlantısız — bu normal, testler genelde izole. Uyarıyı kabul ediyorum.

Hiç hata yok, orphan yok, broken edge yok. **Repair gerekmez.** Publish'e geçiyorum.

---

## PHASE 6: PUBLICATION

### Adım 6 — mindmap.publish çağrısı (ZORUNLU SON ADIM)

```
→ CALL: mcp__mindmap__publish
  INPUT: {
    "artifact": {
      "mindmap": (MindMapJSON — 28 node, 22 edge),
      "validation": (ValidationReport — isValid: true),
      "plan": (ArchitecturePlan — domain_then_layer view)
    },
    "options": {
      "emitEvent": true,
      "writeFiles": {
        "mindmapPath": "./mindmap-output/mindmap.json",
        "validationPath": "./mindmap-output/validation.json",
        "planPath": "./mindmap-output/plan.json"
      },
      "format": "pretty"
    }
  }
```

```
← RESPONSE (tool result):
{
  "published": true,
  "artifactId": "mm_2026-02-07_12-30-00_a1b2c3",
  "paths": {
    "mindmapPath": "./mindmap-output/mindmap.json",
    "validationPath": "./mindmap-output/validation.json",
    "planPath": "./mindmap-output/plan.json"
  },
  "summary": {
    "nodes": 28,
    "edges": 22,
    "groups": 6,
    "languages": ["typescript"],
    "warnings": 2,
    "errors": 0
  },
  "payloadSizeBytes": 18432
}
```

Ayrıca **structuredContent** olarak (frontend için):
```json
{
  "eventType": "mindmap/final",
  "artifactId": "mm_2026-02-07_12-30-00_a1b2c3",
  "data": {
    "mindmap": { "meta": {...}, "nodes": [...], "edges": [...] },
    "validation": { "isValid": true, "warnings": [...], "stats": {...} },
    "plan": { "architecture": {...}, "groups": [...], "classifications": [...] }
  },
  "meta": {
    "generatedAt": "2026-02-07T12:30:00Z",
    "rootPath": "/Users/dev/my-nestjs-app",
    "view": "domain_then_layer",
    "toolVersions": { "mcpServer": "1.0.0", "treeSitter": "0.22.0" }
  }
}
```

---

## SON ÇIKTI — Kullanıcıya Söylediğim

> Mind map başarıyla oluşturuldu ve `mindmap.publish` ile yayınlandı.
>
> **Proje**: My NestJS E-Commerce API
> **Mimari**: NestJS Modular Architecture + Event-Driven Processing
> **Framework**: NestJS, TypeORM, Passport, EventEmitter2
>
> **Keşfedilen Yapı:**
> - **Authentication & Authorization** — AuthService, AuthGuard, RolesGuard, JWT/Local strategies
> - **User Management** — UsersService, UsersRepository, User entity
> - **Product Catalog** — ProductsService, Product entity
> - **Order Processing** — OrdersService + event-driven async (OrderCreatedListener)
> - **Infrastructure** — Database config, migrations, common utilities
>
> **Önemli Keşif:** OrdersService → OrderCreatedListener arasında import graph'ta görünmeyen bir event-driven ilişki tespit edildi. Order oluşturulduğunda asenkron email bildirimi ve stok güncellemesi tetikleniyor.
>
> **28 node, 22 edge, 6 grup** — Dosyalar `./mindmap-output/` altına yazıldı.

---

## SIMÜLASYONUN ÖZETİ

### Tool Çağrı Sırası ve Sayısı

| # | Tool | Amaç | Token Maliyeti |
|---|------|------|----------------|
| 1 | `mindmap.scan` | Dosya listesi | Düşük |
| 2 | `mindmap.resolve` | Stabil ID + hash | Düşük |
| 3 | `mindmap.context` | Proje metadata | Düşük |
| 4 | `mindmap.parse` (summary) | 48 dosya özet | Orta |
| 5 | `mindmap.parse` (standard) | 5 core dosya detay | Orta |
| 6 | `mindmap.sample` | 1 dosya snippet | Düşük |
| 7 | `mindmap.build` | Graf inşası | Düşük |
| 8 | `mindmap.validate` | Tutarlılık kontrolü | Düşük |
| 9 | `mindmap.publish` | Final çıktı | Düşük |

**Toplam: 9 tool çağrısı**

### LLM'in Yaptığı Kararlar (Tool'ların Yapamayacağı)

1. **"RolesGuard auth grubuna ait"** — Dosya `common/guards/` altında ama mantıksal olarak auth domain'inde. Tool bunu bilemez.
2. **"Event-driven ilişki var"** — `OrdersService` → EventEmitter2 → `OrderCreatedListener`. Import graph'ta dolaylı, LLM code sample okuyarak anladı.
3. **"domain_then_layer view uygun"** — Bu proje domain-first organize edilmiş, LLM bunu pattern olarak tanıdı.
4. **"DTO'lar peripheral, collapse edilmeli"** — Token tasarrufu ve görsel temizlik için LLM karar verdi.
5. **"AuthGuard ↔ Controllers arasında conceptual ilişki var"** — @UseGuards() decorator ile bağlanıyorlar, import yok.
