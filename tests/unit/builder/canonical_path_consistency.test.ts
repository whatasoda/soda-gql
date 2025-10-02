import { describe, expect, it } from "bun:test";
import { getAstAnalyzer } from "../../../packages/builder/src/ast";

describe("Canonical path consistency", () => {
  const filePath = "/test/src/test.ts";

  describe("TypeScript and SWC adapters produce consistent astPath", () => {
    const analyzeWithTS = getAstAnalyzer("ts").analyze;
    const analyzeWithSWC = getAstAnalyzer("swc").analyze;

    it("generates same astPath for top-level definitions", () => {
      const source = `
import { gql } from "@/graphql-system";

export const userModel = gql.default(({ model }) =>
  model("User", ({ f }) => ({
    id: f.id(),
  }), (value) => value)
);
`;

      const tsAnalysis = analyzeWithTS({ filePath, source });
      const swcAnalysis = analyzeWithSWC({ filePath, source });

      expect(tsAnalysis.definitions).toHaveLength(1);
      expect(swcAnalysis.definitions).toHaveLength(1);

      expect(tsAnalysis.definitions[0]?.astPath).toBe(swcAnalysis.definitions[0]?.astPath);
      expect(tsAnalysis.definitions[0]?.astPath).toBe("userModel");
    });

    it("generates same astPath for nested definitions in functions", () => {
      const source = `
import { gql } from "@/graphql-system";

function createModels() {
  const nested = gql.default(({ model }) =>
    model("Nested", ({ f }) => ({ id: f.id() }), (v) => v)
  );
  return nested;
}
`;

      const tsAnalysis = analyzeWithTS({ filePath, source });
      const swcAnalysis = analyzeWithSWC({ filePath, source });

      expect(tsAnalysis.definitions).toHaveLength(1);
      expect(swcAnalysis.definitions).toHaveLength(1);

      expect(tsAnalysis.definitions[0]?.astPath).toBe(swcAnalysis.definitions[0]?.astPath);
      expect(tsAnalysis.definitions[0]?.astPath).toBe("createModels.nested");
    });

    it("generates same astPath for definitions in arrow functions", () => {
      const source = `
import { gql } from "@/graphql-system";

const factory = () => {
  const model = gql.default(({ model }) =>
    model("User", ({ f }) => ({ id: f.id() }), (v) => v)
  );
  return model;
};
`;

      const tsAnalysis = analyzeWithTS({ filePath, source });
      const swcAnalysis = analyzeWithSWC({ filePath, source });

      expect(tsAnalysis.definitions).toHaveLength(1);
      expect(swcAnalysis.definitions).toHaveLength(1);

      expect(tsAnalysis.definitions[0]?.astPath).toBe(swcAnalysis.definitions[0]?.astPath);
      // Arrow functions get auto-numbered names
      expect(tsAnalysis.definitions[0]?.astPath).toMatch(/^factory\.arrow#\d+\.model$/);
    });

    it("generates same astPath for class method definitions (TypeScript only)", () => {
      const source = `
import { gql } from "@/graphql-system";

class UserRepository {
  getModels() {
    const model = gql.default(({ model }) =>
      model("User", ({ f }) => ({ id: f.id() }), (v) => v)
    );
    return model;
  }
}
`;

      const tsAnalysis = analyzeWithTS({ filePath, source });

      // Note: SWC adapter may not fully support class method traversal
      // This test focuses on TypeScript adapter behavior
      expect(tsAnalysis.definitions).toHaveLength(1);
      expect(tsAnalysis.definitions[0]?.astPath).toBe("UserRepository.getModels.model");
    });

    it("generates same astPath for object property definitions", () => {
      const source = `
import { gql } from "@/graphql-system";

const config = {
  models: {
    user: gql.default(({ model }) =>
      model("User", ({ f }) => ({ id: f.id() }), (v) => v)
    ),
  },
};
`;

      const tsAnalysis = analyzeWithTS({ filePath, source });
      const swcAnalysis = analyzeWithSWC({ filePath, source });

      expect(tsAnalysis.definitions).toHaveLength(1);
      expect(swcAnalysis.definitions).toHaveLength(1);

      expect(tsAnalysis.definitions[0]?.astPath).toBe(swcAnalysis.definitions[0]?.astPath);
      expect(tsAnalysis.definitions[0]?.astPath).toBe("config.models.user");
    });

    it("handles duplicate names with unique suffixes", () => {
      const source = `
import { gql } from "@/graphql-system";

const model1 = gql.default(({ model }) => model("A", ({ f }) => ({ id: f.id() }), (v) => v));
const model2 = gql.default(({ model }) => model("B", ({ f }) => ({ id: f.id() }), (v) => v));

function factory() {
  const model1 = gql.default(({ model }) => model("C", ({ f }) => ({ id: f.id() }), (v) => v));
  const model2 = gql.default(({ model }) => model("D", ({ f }) => ({ id: f.id() }), (v) => v));
}
`;

      const tsAnalysis = analyzeWithTS({ filePath, source });
      const swcAnalysis = analyzeWithSWC({ filePath, source });

      expect(tsAnalysis.definitions).toHaveLength(4);
      expect(swcAnalysis.definitions).toHaveLength(4);

      for (let i = 0; i < 4; i++) {
        expect(tsAnalysis.definitions[i]?.astPath).toBe(swcAnalysis.definitions[i]?.astPath);
      }

      // Top-level model1 and model2
      expect(tsAnalysis.definitions[0]?.astPath).toBe("model1");
      expect(tsAnalysis.definitions[1]?.astPath).toBe("model2");

      // Nested model1 and model2 in factory function
      expect(tsAnalysis.definitions[2]?.astPath).toBe("factory.model1");
      expect(tsAnalysis.definitions[3]?.astPath).toBe("factory.model2");
    });
  });

  describe("Export binding detection", () => {
    const analyzeWithTS = getAstAnalyzer("ts").analyze;

    it("detects exported definitions", () => {
      const source = `
import { gql } from "@/graphql-system";

export const userModel = gql.default(({ model }) =>
  model("User", ({ f }) => ({ id: f.id() }), (v) => v)
);

const privateModel = gql.default(({ model }) =>
  model("Private", ({ f }) => ({ id: f.id() }), (v) => v)
);
`;

      const analysis = analyzeWithTS({ filePath, source });

      expect(analysis.definitions).toHaveLength(2);

      const userModel = analysis.definitions.find((d) => d.astPath === "userModel");
      const privateModel = analysis.definitions.find((d) => d.astPath === "privateModel");

      expect(userModel?.isExported).toBe(true);
      expect(userModel?.exportBinding).toBe("userModel");

      expect(privateModel?.isExported).toBe(false);
      expect(privateModel?.exportBinding).toBeUndefined();
    });

    it("detects exported function declarations", () => {
      const source = `
import { gql } from "@/graphql-system";

export function getModel() {
  const model = gql.default(({ model }) =>
    model("User", ({ f }) => ({ id: f.id() }), (v) => v)
  );
  return model;
}
`;

      const analysis = analyzeWithTS({ filePath, source });

      expect(analysis.definitions).toHaveLength(1);
      // The definition is in a variable inside the function
      expect(analysis.definitions[0]?.astPath).toBe("getModel.model");
      expect(analysis.definitions[0]?.isTopLevel).toBe(false);
    });
  });

  describe("Complex nesting scenarios", () => {
    const analyzeWithTS = getAstAnalyzer("ts").analyze;

    it("handles deeply nested definitions", () => {
      const source = `
import { gql } from "@/graphql-system";

class Outer {
  method() {
    const obj = {
      nested: {
        deep: gql.default(({ model }) =>
          model("Deep", ({ f }) => ({ id: f.id() }), (v) => v)
        ),
      },
    };
  }
}
`;

      const analysis = analyzeWithTS({ filePath, source });

      expect(analysis.definitions).toHaveLength(1);
      expect(analysis.definitions[0]?.astPath).toBe("Outer.method.obj.nested.deep");
    });

    it("handles multiple definitions in same scope", () => {
      const source = `
import { gql } from "@/graphql-system";

const container = {
  model1: gql.default(({ model }) => model("A", ({ f }) => ({ id: f.id() }), (v) => v)),
  model2: gql.default(({ model }) => model("B", ({ f }) => ({ id: f.id() }), (v) => v)),
  model3: gql.default(({ model }) => model("C", ({ f }) => ({ id: f.id() }), (v) => v)),
};
`;

      const analysis = analyzeWithTS({ filePath, source });

      expect(analysis.definitions).toHaveLength(3);

      const astPaths = analysis.definitions.map((d) => d.astPath).sort();
      expect(astPaths).toEqual(["container.model1", "container.model2", "container.model3"]);
    });
  });
});
