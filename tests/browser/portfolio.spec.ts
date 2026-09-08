import { test, expect } from "@playwright/test";
test("galeria, filtros, busca, modal e layout mobile", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.locator(".video-card").first()).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Boas histórias/ }),
  ).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 500));
  await expect(page.locator(".animated-logo")).toHaveClass(/is-centered/);
  await page.waitForTimeout(1750);
  const centeredLogo = await page.locator(".animated-logo").boundingBox();
  expect(centeredLogo).not.toBeNull();
  expect(
    Math.abs(centeredLogo!.x + centeredLogo!.width / 2 - 720),
  ).toBeLessThan(3);
  expect(Math.abs(centeredLogo!.y - 14)).toBeLessThan(3);
  await page.screenshot({ path: "test-results/logo-dock.png" });
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator(".animated-logo")).not.toHaveClass(/is-centered/);
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Comercial", exact: true }).click();
  for (const card of await page.locator(".video-card").all())
    await expect(card.locator(".category-chip")).toHaveText("Comercial");
  await page
    .getByRole("textbox", { name: "Buscar projeto" })
    .fill("inexistente123456");
  await expect(page.getByText("Nenhum projeto encontrado")).toBeVisible();
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await page.locator(".video-card").first().click();
  await expect(page.locator("dialog[open] iframe")).toHaveAttribute(
    "src",
    /youtube-nocookie.com\/embed\/[\w-]{11}/,
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".video-card").first()).toBeVisible();
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("link", { name: "Sobre mim", exact: true }).click();
  await expect(page.getByRole("button", { name: "Abrir menu" })).toBeVisible();
  await page.goto("/");
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  for (const width of [320, 375, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.locator("body")).toHaveJSProperty("scrollWidth", width);
  }
  expect(errors).toEqual([]);
});
test("painel: login, criar, editar, excluir e sair", async ({ page }) => {
  test.setTimeout(45_000);
  const categoryName = `Fashion E2E ${Date.now()}`;
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Bom ter você de volta." }),
  ).toBeVisible();
  await page
    .getByLabel("E-mail", { exact: true })
    .fill(process.env.ADMIN_EMAIL!);
  await page
    .getByLabel("Senha", { exact: true })
    .fill(process.env.ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Entrar no painel" }).click();
  await expect(
    page.getByRole("heading", { name: "Suas histórias." }),
  ).toBeVisible();
  await page.getByLabel("Nova categoria").fill(categoryName);
  await page.getByRole("button", { name: "Adicionar" }).click();
  await expect(page.getByRole("status")).toContainText(
    `Categoria “${categoryName}” adicionada.`,
  );
  const publicPage = await page.context().newPage();
  await publicPage.goto("/", { waitUntil: "domcontentloaded" });
  await expect(
    publicPage.getByRole("button", { name: categoryName }),
  ).toBeVisible();
  await publicPage.close();
  await page.getByRole("button", { name: "Novo projeto" }).click();
  await page.getByLabel("Título do projeto").fill("Projeto E2E temporário");
  await page.getByLabel("URL do YouTube").fill("https://youtu.be/dQw4w9WgXcQ");
  await page
    .getByLabel("Descrição", { exact: true })
    .fill("Projeto temporário criado pelo teste de navegador.");
  await page
    .getByRole("combobox", { name: "Categoria" })
    .selectOption(categoryName);
  await page.getByLabel("Usar como showreel").check();
  await page.getByRole("button", { name: "Publicar projeto" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Projeto publicado com sucesso.",
  );
  await expect(
    page.getByRole("button", {
      name: "Showreel atual: Projeto E2E temporário",
    }),
  ).toBeVisible();
  const showreelPage = await page.context().newPage();
  await showreelPage.goto("/", { waitUntil: "domcontentloaded" });
  await showreelPage
    .getByRole("button", { name: "Assista ao showreel" })
    .click();
  await expect(showreelPage.locator(".dialog-description h2")).toHaveText(
    "Projeto E2E temporário",
  );
  await showreelPage.getByRole("button", { name: "Fechar vídeo" }).click();
  await showreelPage
    .getByRole("button", { name: "Assistir ao projeto em destaque" })
    .click();
  await expect(showreelPage.locator(".dialog-description h2")).toHaveText(
    "Projeto E2E temporário",
  );
  await showreelPage.close();
  await page
    .getByRole("button", { name: "Editar Projeto E2E temporário" })
    .click();
  await page.getByLabel("Título do projeto").fill("Projeto E2E atualizado");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByRole("status")).toHaveText("Projeto atualizado.");
  await page
    .getByRole("button", { name: "Excluir Projeto E2E atualizado" })
    .click();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Projeto E2E atualizado" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Excluir Projeto E2E atualizado" })
    .click();
  await page
    .getByRole("button", { name: "Excluir projeto", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Projeto excluído.");
  await page
    .getByRole("button", { name: `Remover categoria ${categoryName}` })
    .click();
  await expect(page.getByRole("status")).toContainText(
    `Categoria “${categoryName}” removida.`,
  );
  await page.screenshot({ path: "test-results/admin.png", fullPage: true });
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Bom ter você de volta." }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Bom ter você de volta." }),
  ).toBeVisible();
});
