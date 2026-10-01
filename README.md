# Playsaurus

Ferramenta local para manter documentação de vários produtos e publicar um portal
standalone dentro de cada aplicação.

O fluxo principal é simples:

```text
Markdown → Playsaurus → output/interno + output/cliente → publicação
```

O Playsaurus compila Markdown diretamente. O artefato publicado não depende de
React, Docusaurus ou de um servidor especial.

## Começando

No Windows, abra `painel.bat`. Pelo terminal:

```bash
npm install
npm run painel
```

O painel abre em `http://127.0.0.1:4321`.

## Comandos principais

| Comando | O que faz |
|---|---|
| `npm run painel` | Abre o painel local |
| `npm run start -- <id>` | Gera e abre o preview |
| `npm run build -- <id>` | Gera interno + cliente |
| `npm run serve -- <id>` | Serve o standalone já gerado |
| `npm run screenshots -- <id>` | Captura screenshots do produto |
| `npm run pdf -- <id>` | Gera PDFs cliente/equipe |
| `npm run publish -- <id>` | Publica `output/cliente` no repositório do produto |

Ferramentas pouco usadas continuam disponíveis por CLI:

```bash
npm run i18n:init -- <id>
npm run i18n:check -- <id>
npm run videos -- <id>
npm run auditoria -- <id>
```

## Estrutura de um projeto

Tudo que pertence a um produto fica em `projetos/<id>/`:

```text
projetos/<id>/
├── projeto.json
├── tema.css
├── docs/                    # idioma padrão
├── i18n/                    # traduções
│   ├── en/
│   └── es/
├── static/                  # imagens e PDFs fonte
├── playwright/              # screenshots
├── output/
│   ├── interno/
│   └── cliente/
└── .playsaurus/             # temporários/cache descartáveis
```

`output/` pode ser regenerado. `.playsaurus/` pode ser apagado a qualquer
momento sem perder fonte da documentação.

## Documentação

Use arquivos `.md`. O `index.md` é a página inicial de uma seção. As demais
páginas devem usar prefixo numérico quando a ordem importar:

```text
docs/usabilidade/
├── index.md
├── 01-primeiros-passos.md
├── 02-login.md
└── 03-dashboard.md
```

O prefixo numérico não entra na URL final.

As regras completas para escrever conteúdo estão em:

```text
.LER ANTES DE USAR/COMO-PREENCHER-A-DOCUMENTACAO.md
```

## Idiomas

O idioma padrão vive em `docs/`. Cada tradução repete a mesma árvore diretamente
sob `i18n/<locale>/`:

```text
docs/usabilidade/02-login.md
i18n/en/usabilidade/02-login.md
i18n/es/usabilidade/02-login.md
```

Para criar os arquivos pendentes:

```bash
npm run i18n:init -- <id>
```

Enquanto um arquivo contém `PLAYSAURUS_TRANSLATION_PENDING`, aquele locale não é
considerado completo.

## Interno x cliente

O mesmo conjunto de páginas gera dois artefatos:

```text
output/interno/   todas as seções
output/cliente/   somente seções publicáveis
```

No `projeto.json`, uma seção com:

```json
{
  "id": "arquitetura",
  "publicar": false
}
```

continua disponível internamente, mas não entra no portal do cliente.

O campo `publico: admin` dentro de um artigo tem outro objetivo: ajuda a Central
de Ajuda a filtrar resultados por perfil. Ele não é uma barreira de segurança.
Conteúdo sigiloso deve ficar fora do build cliente por seção.

## Saída

Cada build standalone contém, conforme aplicável:

```text
index.html
help-index.json
sitemap.xml          # cliente
pdf/
```

O `index.html` contém navegação, busca, tema, idiomas, artigos e imagens
necessárias para o portal.

## Publicação

`npm run publish -- <id>` atualiza o build e copia somente `output/cliente/` para
`repositorio.destino` do produto, normalmente `public/docs`.

O caminho local do repositório pode variar por máquina e é salvo em
`caminhos.local.json`, que não deve ser versionado.

## Novo projeto

O painel cria o esqueleto mínimo:

```text
projetos/<id>/
├── projeto.json
├── tema.css
├── docs/<secao>/index.md
├── static/img/usabilidade/geradas/.gitkeep
├── playwright/
├── .env.example
└── README.md
```

Não é necessário configurar formato de output: o Playsaurus sempre gera
standalone.

## Extras

Recursos que não participam do build normal ficam em `extras/`:

```text
extras/
├── auditoria/
├── i18n/
└── video/
```

Screenshots permanecem no fluxo principal porque servem diretamente à produção
da documentação.
