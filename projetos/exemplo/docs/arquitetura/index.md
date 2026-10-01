# Arquitetura do Playsaurus

O Playsaurus é uma ferramenta local para manter a documentação de vários produtos a partir de uma única instalação. Cada produto possui seus próprios documentos, tema, configuração, screenshots e artefatos; o código da ferramenta permanece compartilhado.

## Stack principal

| Camada | Tecnologia | Função |
|---|---|---|
| Runtime | Node.js | Painel local, build, publicação e automações |
| Conteúdo | Markdown | Fonte dos artigos da documentação |
| Renderização | markdown-it | Conversão do Markdown para HTML |
| Automação de navegador | Playwright | Screenshots e fluxos auxiliares |
| Diagramas | Mermaid | Diagramas incorporados aos artigos |
| PDF | Playwright + pdf-lib | Impressão e consolidação da documentação |
| Configuração | JSON, CSS e `.env` | Projeto, tema e credenciais locais |

O portal publicado é standalone: o produto cliente recebe arquivos estáticos e não precisa executar o Playsaurus em produção.

## Organização da instalação

```text
playsaurus/
├── painel/                  interface local
├── scripts/                 build, preview, PDF e publicação
├── compartilhado/          compilador e runtime do portal
├── extras/                 auditoria, vídeo e auxiliares opcionais
└── projetos/
    └── <id>/
        ├── projeto.json
        ├── tema.css
        ├── docs/
        ├── i18n/
        ├── static/
        ├── playwright/
        ├── output/
        └── .playsaurus/
```

O conteúdo permanente de um produto fica em `projetos/<id>/`. `output/` e `.playsaurus/` são regeneráveis.

## Modelo de páginas

Durante o build, os arquivos `.md` são lidos e normalizados em um único modelo de páginas. Esse mesmo modelo alimenta:

- o portal standalone;
- `help-index.json`;
- `sitemap.xml` do pacote cliente;
- navegação e busca;
- exportação para PDF.

Isso evita que cada saída interprete a documentação de uma forma diferente.

## Build interno e cliente

Um único comando gera os dois artefatos:

```bash
npm run build -- <id>
```

Saídas:

```text
projetos/<id>/output/
├── interno/
└── cliente/
```

O pacote **interno** pode conter todas as seções. O pacote **cliente** remove as seções marcadas com `"publicar": false` em `projeto.json`.

Essa separação é feita durante o empacotamento. Um link de uma página pública para uma seção interna é mantido como texto, mas a navegação é desativada no pacote cliente.

## Publicação

`npm run publish -- <id>` gera a documentação e copia somente `output/cliente/` para o caminho configurado em `repositorio.destino`, normalmente `public/docs` do produto.

O caminho local do repositório não precisa ficar gravado no projeto: o painel salva caminhos específicos da máquina em `caminhos.local.json`.

## Dados sensíveis

Credenciais usadas por screenshots ou auditorias ficam em `projetos/<id>/.env`, que não deve ser versionado. O `projeto.json` contém apenas nomes de variáveis e configuração não sensível.

A opção `publico: admin` de um artigo serve para filtragem da Central de Ajuda; ela não substitui a separação entre conteúdo interno e cliente.

## Extras

Auditoria e gravação de vídeo não participam do build normal. Elas ficam em `extras/` e são executadas somente quando chamadas pelo CLI, mantendo o núcleo da documentação menor e mais previsível.
