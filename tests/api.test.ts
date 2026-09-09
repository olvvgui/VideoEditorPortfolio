import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
const base = process.env.TEST_API_URL;
test(
  "API: autenticação, proteção, validação e ciclo completo do CRUD",
  { skip: !base },
  async () => {
    const headers = {
      "Content-Type": "application/json",
      Origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
    };
    const project = {
      title: "Teste de integração",
      description: "Projeto temporário para validação do CRUD.",
      youtubeUrl: "https://youtu.be/dQw4w9WgXcQ",
      category: "Comercial",
      isShowreel: true,
    };
    const request = (
      path: string,
      method = "GET",
      body?: unknown,
      cookie?: string,
    ) =>
      fetch(`${base}${path}`, {
        method,
        headers: { ...headers, ...(cookie ? { Cookie: cookie } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    assert.equal((await request("/videos", "POST", project)).status, 401);
    assert.equal((await request("/auth/me")).status, 401);
    assert.equal(
      (
        await request("/auth/login", "POST", {
          email: process.env.ADMIN_EMAIL,
          password: "wrong-password",
        })
      ).status,
      401,
    );
    const login = await request("/auth/login", "POST", {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    });
    assert.equal(login.status, 200);
    const setCookie = login.headers.get("set-cookie")!;
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Strict/i);
    const cookie = setCookie.split(";")[0];
    assert.equal(
      (await request("/auth/me", "GET", undefined, cookie)).status,
      200,
    );
    assert.equal(
      (await request("/categories", "POST", { name: "Sem sessão" })).status,
      401,
    );
    const categoryName = `Categoria integração ${Date.now()}`;
    const createdCategoryResponse = await request(
      "/categories",
      "POST",
      { name: categoryName },
      cookie,
    );
    assert.equal(createdCategoryResponse.status, 201);
    const createdCategory = (await createdCategoryResponse.json()) as {
      id: string;
      name: string;
    };
    project.category = createdCategory.name;
    const publicCategories = (await (await request("/categories")).json()) as {
      name: string;
    }[];
    assert.ok(publicCategories.some(({ name }) => name === categoryName));
    assert.equal(
      (
        await request(
          "/videos",
          "POST",
          {
            ...project,
            youtubeUrl: "https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ",
          },
          cookie,
        )
      ).status,
      400,
    );
    assert.equal(
      (await request("/videos", "POST", { ...project, title: "   " }, cookie))
        .status,
      400,
    );
    assert.equal(
      (
        await request(
          "/videos",
          "POST",
          { ...project, videoId: "injected" },
          cookie,
        )
      ).status,
      400,
    );
    const crossOrigin = await fetch(`${base}/videos`, {
      method: "POST",
      headers: { ...headers, Origin: "https://evil.test", Cookie: cookie },
      body: JSON.stringify(project),
    });
    assert.equal(crossOrigin.status, 403);
    const created = await request("/videos", "POST", project, cookie);
    assert.equal(created.status, 201);
    const v = (await created.json()) as { id: string; videoId: string };
    assert.equal(v.videoId, "dQw4w9WgXcQ");
    try {
      assert.equal(
        (
          await request(
            `/categories/${createdCategory.id}`,
            "DELETE",
            undefined,
            cookie,
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await request(
            `/videos/${v.id}`,
            "PUT",
            {
              ...project,
              title: "Atualizado",
              youtubeUrl: "https://youtube.com/shorts/aqz-KE-bpKQ",
            },
            cookie,
          )
        ).status,
        200,
      );
      const { items: list } = (await (await request("/videos")).json()) as {
        items: {
          id: string;
          title: string;
          videoId: string;
          isShowreel: boolean;
        }[];
      };
      assert.equal(list.find((x) => x.id === v.id)?.title, "Atualizado");
      assert.equal(list.find((x) => x.id === v.id)?.videoId, "aqz-KE-bpKQ");
      assert.equal(list.find((x) => x.id === v.id)?.isShowreel, true);
      assert.equal(list.filter(({ isShowreel }) => isShowreel).length, 1);
    } finally {
      assert.equal(
        (await request(`/videos/${v.id}`, "DELETE", undefined, cookie)).status,
        200,
      );
    }
    assert.equal(
      (await request(`/videos/${v.id}`, "DELETE", undefined, cookie)).status,
      404,
    );
    assert.equal(
      (
        await request(
          `/categories/${createdCategory.id}`,
          "DELETE",
          undefined,
          cookie,
        )
      ).status,
      200,
    );
    const logout = await request("/auth/logout", "POST", undefined, cookie);
    assert.equal(logout.status, 200);
    assert.match(logout.headers.get("set-cookie")!, /Expires=Thu, 01 Jan 1970/);
    assert.equal(
      (await request("/auth/me", "GET", undefined, cookie)).status,
      401,
    );
  },
);
