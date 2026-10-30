export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const body = await request.json();
    const { products, pin } = body;

    // Optional PIN verification if set in Cloudflare Environment
    const expectedPin = env.ADMIN_PIN || 'sahila123';
    if (pin && pin !== expectedPin) {
      return new Response(JSON.stringify({ error: 'PIN tidak valid' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!Array.isArray(products)) {
      return new Response(JSON.stringify({ error: 'Data produk tidak valid' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GitHub Personal Access Token stored safely in Cloudflare Environment
    const githubToken = env.GITHUB_TOKEN;
    if (!githubToken) {
      return new Response(
        JSON.stringify({
          error: 'GITHUB_TOKEN belum diatur di Cloudflare Pages Environment Variables',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const repo = env.GITHUB_REPO || 'digistackonline-tech/Sahila-Craft';
    const branch = env.GITHUB_BRANCH || 'main';
    const fileUrl = `https://api.github.com/repos/${repo}/contents/data/products.json`;

    // 1. Get current SHA of data/products.json
    let sha = null;
    const checkResp = await fetch(fileUrl, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'SahilaCraft-API',
      },
    });

    if (checkResp.ok) {
      const fileData = await checkResp.json();
      sha = fileData.sha;
    }

    // 2. Prepare JSON payload with UTF-8 base64 encoding
    const jsonString = JSON.stringify(products, null, 2);
    const utf8Bytes = new TextEncoder().encode(jsonString);
    let binary = '';
    for (let i = 0; i < utf8Bytes.length; i++) {
      binary += String.fromCharCode(utf8Bytes[i]);
    }
    const base64Content = btoa(binary);

    // 3. Commit to GitHub
    const commitPayload = {
      message: `chore(catalog): update products via Sahila Craft Cloudflare API (${products.length} items)`,
      content: base64Content,
      branch: branch,
    };
    if (sha) {
      commitPayload.sha = sha;
    }

    const putResp = await fetch(fileUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${githubToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'SahilaCraft-API',
      },
      body: JSON.stringify(commitPayload),
    });

    if (!putResp.ok) {
      const errorJson = await putResp.json();
      return new Response(
        JSON.stringify({
          error: errorJson.message || 'Gagal menyimpan ke GitHub',
        }),
        {
          status: putResp.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const result = await putResp.json();
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Katalog berhasil dipublikasikan ke GitHub & Cloudflare',
        commit: result.commit ? result.commit.sha : null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Terjadi kesalahan server' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
