# Usando o Playsaurus

O painel do Playsaurus concentra o fluxo diário: escolher um projeto, conferir onde está o repositório na máquina, gerar a documentação, visualizar as duas versões e copiar o resultado para o produto.

![Painel principal do Playsaurus](/img/playsaurus/painel.png)

## Escolher um projeto

No combo **Projeto**, selecione o produto que deseja documentar. O cartão exibe o endereço da documentação, as seções disponíveis e a configuração local do repositório.

Se o caminho do repositório ainda não estiver configurado nesta máquina, informe-o e clique em **Salvar**. As ações que dependem desse caminho permanecem bloqueadas até a configuração ser salva.

## Configurar o que vai para o cliente

Quando o projeto possui uma seção **Arquitetura**, o painel permite definir se ela entra ou não no site do cliente.

- **Incluída:** Arquitetura aparece no build cliente.
- **Só interna:** Arquitetura existe apenas no build interno.

Essa configuração altera o conteúdo publicado; não é apenas uma opção visual do painel.

## URL pública

A **URL pública** é usada pelo sitemap e pelos links absolutos do pacote publicado. Antes de copiar a documentação para um ambiente real, troque URLs de `localhost` pelo endereço definitivo e salve.

## Gerar a documentação

Clique em **Gerar build** para produzir:

```text
output/interno/
output/cliente/
```

O build lê Markdown, incorpora os assets necessários e atualiza os índices auxiliares.

## Visualizar

Use:

- **Visualizar (interno)** para conferir todas as seções;
- **Visualizar (cliente)** para conferir exatamente o que será copiado para o produto.

Antes de publicar, a visualização cliente é a referência para verificar se conteúdo interno foi realmente removido.

## Exportar PDF

**Exportar PDF** gera a documentação em A4 usando o próprio portal final como fonte. Assim, o PDF segue as mesmas páginas e os mesmos idiomas do build standalone.

Quando existe um único idioma, os arquivos usam nomes simples como:

```text
documentacao-cliente.pdf
documentacao-equipe.pdf
```

## Copiar para Repositório

Depois de revisar o build cliente, clique em **Copiar para Repositório**. O Playsaurus copia o conteúdo de `output/cliente/` para o destino configurado no repositório do produto.

Esse passo não envia código-fonte do Playsaurus nem os documentos Markdown; apenas o artefato final é copiado.

## Ferramentas

A área **Ferramentas** reúne ações usadas com menos frequência, como:

- gerar screenshots;
- abrir a pasta do projeto;
- abrir a pasta de saída;
- limpar cache;
- limpar builds.

Screenshots podem exigir credenciais de demonstração em `projetos/<id>/.env`. O painel mostra um aviso quando elas ainda não estão configuradas.

## Criar um novo projeto

Na área **Novo projeto**, preencha:

1. **Identificador** — vira o nome da pasta e o argumento dos comandos;
2. **Nome do projeto** — nome exibido no portal;
3. **Endereço do app** — URL usada para screenshots;
4. **Caminho da documentação** — normalmente `/docs/`;
5. **Idioma padrão**;
6. **Cor da marca**.

O Playsaurus cria o esqueleto inicial em `projetos/<id>/`, incluindo as três seções padrão, tema e arquivos de configuração.
