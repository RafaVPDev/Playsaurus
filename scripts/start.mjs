/**
 * Gera e serve a documentação interna de um produto.
 *
 * Uso: npm run start -- meu-projeto
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { carregarProjeto, executar, idDoArgumento, encerrarComErro } from './comum.mjs';

const aqui = path.dirname(fileURLToPath(import.meta.url));

try {
  const id = idDoArgumento();
  const projeto = carregarProjeto(id);
  console.log(`Gerando a documentação do ${projeto.nome} (${id})...`);
  await executar(process.execPath, [path.join(aqui, 'build.mjs'), id]);
  console.log(`\nServindo a documentação interna do ${projeto.nome}...`);
  await executar(process.execPath, [path.join(aqui, 'serve.mjs'), id], {
    env: { DOC_PROJETO: id, DOC_MODO: 'interno' },
  });
} catch (e) {
  encerrarComErro(e);
}
