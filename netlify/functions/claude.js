exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let parsed;
  try {
    parsed = JSON.parse(event.body || '{}');
  } catch(e) {
    return { statusCode: 400, body: JSON.stringify({ text: 'JSON 파싱 오류: ' + e.message }) };
  }

  const { system, prompt, max_tokens = 1500 } = parsed;

  if (!prompt) {
    return { statusCode: 400, body: JSON.stringify({ text: 'prompt가 없습니다' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 200, body: JSON.stringify({ text: '오류: API 키가 없습니다.' }) };
  }

  // 이모지 등 특수문자 안전하게 처리
  const safePrompt = prompt.replace(/[\u{D800}-\u{DFFF}]/gu, '');
  const safeSystem = system ? system.replace(/[\u{D800}-\u{DFFF}]/gu, '') : null;

  try {
    const body = {
      model: 'claude-sonnet-4-20250514',
      max_tokens,
      messages: [{ role: 'user', content: safePrompt }]
    };
    if (safeSystem) body.system = safeSystem;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();

    if (data.error) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'API 오류: ' + data.error.type + ' — ' + data.error.message })
      };
    }

    const text = data.content?.map(b => b.text || '').join('') || '(응답 없음)';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    };
  } catch (err) {
    return {
      statusCode: 200,
      body: JSON.stringify({ text: '서버 오류: ' + err.message })
    };
  }
};
