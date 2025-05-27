
import { type NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('targetUrl');

  if (!targetUrl) {
    return NextResponse.json({ error: 'Parâmetro "targetUrl" é obrigatório.' }, { status: 400 });
  }

  try {
    // Validar a URL de destino (opcional, mas recomendado para segurança)
    // Por exemplo, verificar se é um HTTP/HTTPS válido ou se pertence a domínios esperados
    // new URL(targetUrl); // Lança erro se for inválida

    const response = await fetch(targetUrl, {
      headers: {
        // Alguns servidores podem exigir um User-Agent
        'User-Agent': 'CatCakeFlix-Playlist-Proxy/1.0',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Falha ao buscar a URL de destino: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type') || 'text/plain; charset=utf-8';
    const textContent = await response.text();

    // Criar uma nova resposta com o conteúdo e o tipo de conteúdo corretos
    const proxyResponse = new NextResponse(textContent, {
      status: 200,
      headers: {
        'Content-Type': contentType,
      },
    });
    return proxyResponse;

  } catch (error: any) {
    console.error('Erro no proxy API:', error);
    let errorMessage = 'Erro interno do servidor ao tentar buscar a URL.';
    if (error.message) {
        errorMessage = `Erro ao processar a URL no proxy: ${error.message}`;
    }
    if (error.cause && error.cause.code === 'ENOTFOUND'){
        errorMessage = `Não foi possível encontrar o host da URL fornecida: ${targetUrl}`;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
