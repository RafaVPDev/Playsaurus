# Playsaurus — documentação

- **Publicada em:** http://localhost:8080/docs/
- **Repositório do produto:** `playsaurus`
- **Destino:** `public/docs`
- **Formato padrão:** standalone (um `index.html` + `help-index.json` + PDFs)

## Fluxo

```bash
npm run i18n:init -- exemplo        # cria scaffolds dos idiomas adicionais configurados
npm run i18n:check -- exemplo       # mostra traduções pendentes
npm run screenshots -- exemplo      # captura os idiomas configurados
npm run auditoria -- exemplo         # auditoria Playwright read-only
npm run pdf -- exemplo              # PDFs por idioma
npm run build -- exemplo            # gera interno + cliente a partir do mesmo modelo de páginas
npm run publish -- exemplo          # publica só o artefato final
```

O Playsaurus compila Markdown diretamente para o portal standalone. Não há
build HTML intermediário nem runtime de outro gerador no artefato publicado.

## Idiomas

O idioma escolhido na criação do projeto fica em `docs/` e é o único idioma
habilitado inicialmente. Para disponibilizar traduções, adicione os locales
pretendidos em `idiomas.disponiveis` no `projeto.json` e execute
`npm run i18n:init -- exemplo`.

As traduções ficam em
`i18n/<locale>/`, espelhando a estrutura de `docs/`. Locales ainda marcados
como `PLAYSAURUS_TRANSLATION_PENDING` não entram no build enquanto a tradução
não estiver pronta.

O runtime final usa hash routing para continuar funcionando com um único arquivo
físico. O idioma inicial respeita `localStorage["app-language"]` quando o
produto hospedeiro já usa essa chave.

## Screenshots

Cada idioma é capturado separadamente. O locale padrão permanece na pasta atual
e os demais entram em subpastas `en/`, `es/` etc. O compilador standalone
embute a imagem correspondente ao idioma automaticamente.

## Auditoria Playwright

A auditoria read-only usa `auditoria.json`, separado do `projeto.json`. O perfil
`padrao` reaproveita as credenciais de screenshots; para testar várias roles,
adicione perfis com `envEmail`, `envPassword`, `rotas`, `rotasProibidas`,
`menusVisiveis`, `menusOcultos` e, quando útil, `textosEsperados`.

Para executar só uma role: `npm run auditoria -- exemplo --perfil <id-do-perfil>`.

O resumo é gravado em
`projetos/exemplo/output/auditoria/relatorio.md`. Screenshots e traces
de falha ficam em `projetos/exemplo/.playsaurus/auditoria/`.
