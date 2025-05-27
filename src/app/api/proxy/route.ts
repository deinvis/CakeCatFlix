
import { type NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('targetUrl');

  if (!targetUrl) {
    return NextResponse.json({ error: 'Parâmetro "targetUrl" é obrigatório.' }, { status: 400 });
  }

  try {
    console.log(`Proxying request for: ${targetUrl}`);
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'CatCakeFlix-Proxy/1.0',
        // Pass along range headers if present in the original request to the proxy
        // This is a very basic attempt and might not cover all streaming scenarios.
        // Range: request.headers.get('range') || undefined, // TODO: This needs more robust handling
      },
      // Important for streaming: use a ReadableStream
      // However, Next.js API routes might buffer the whole response by default on some platforms.
      // redirect: 'follow', // fetch handles redirects by default
    });

    if (!response.ok) {
      console.error(`Proxy: Falha ao buscar a URL de destino: ${response.status} ${response.statusText} para ${targetUrl}`);
      return NextResponse.json(
        { error: `Falha ao buscar a URL de destino: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    // Get the body as a ReadableStream
    const body = response.body;
    if (!body) {
      console.error(`Proxy: Corpo da resposta vazio para ${targetUrl}`);
      return NextResponse.json({ error: 'Corpo da resposta vazio da URL de destino.' }, { status: 500 });
    }
    
    // Get content type and length from the original response
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentLength = response.headers.get('content-length');

    const headers = new Headers();
    headers.set('Content-Type', contentType);
    if (contentLength) {
      headers.set('Content-Length', contentLength);
    }
    // Attempt to enable seeking by accepting range requests.
    // This is a very basic approach. True streaming proxies are more complex.
    headers.set('Accept-Ranges', 'bytes');


    // Return a new response with the stream and original headers
    // Vercel Edge/Node.js runtimes have different behaviors with ReadableStream.
    // This might work better in Node.js runtime. Edge runtime might buffer.
    return new NextResponse(body, {
      status: response.status, // Use original status (e.g., 206 Partial Content)
      statusText: response.statusText,
      headers: headers,
    });

  } catch (error: any) {
    console.error('Erro no proxy API:', error, `Target URL: ${targetUrl}`);
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
