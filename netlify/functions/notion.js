exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // 2000자 제한으로 내용 분할
  function splitContent(content) {
    if (!content) return [{ object:'block', type:'paragraph', paragraph:{ rich_text:[{ text:{ content:'' } }] } }];
    const chunks = [];
    let i = 0;
    while (i < content.length) {
      chunks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: [{ text: { content: content.slice(i, i + 1999) } }] }
      });
      i += 1999;
    }
    return chunks;
  }

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  if (!NOTION_TOKEN) {
    return { statusCode: 200, body: JSON.stringify({ error: 'Notion 토큰이 없습니다' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch(e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'JSON 파싱 오류' }) };
  }

  const { action, payload } = body;

  // 페이지 ID 상수
  const PAGES = {
    social_media: '347e0a02-5b03-80a9-8e33-dd59d395e342',
    konnect: '34fe0a02-5b03-8086-b602-f81c3e3043f6',
    seoul_vibe: '35fe0a02-5b03-810a-8c53-c84203615116',
  };

  const notionHeaders = {
    'Authorization': 'Bearer ' + NOTION_TOKEN,
    'Content-Type': 'application/json',
    'Notion-Version': '2022-06-28'
  };

  try {
    // ── 페이지 하위에 새 페이지 생성 ──
    if (action === 'create_page') {
      const { parent_id, title, content } = payload;

      const res = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: notionHeaders,
        body: JSON.stringify({
          parent: { page_id: parent_id },
          properties: {
            title: {
              title: [{ text: { content: title || '제목 없음' } }]
            }
          },
          children: splitContent(content)
        })
      });

      const data = await res.json();
      if (data.object === 'error') {
        return { statusCode: 200, body: JSON.stringify({ error: data.message }) };
      }
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, url: data.url, id: data.id })
      };
    }

    // ── 페이지 내용 읽기 ──
    if (action === 'get_page') {
      const { page_id } = payload;
      const res = await fetch('https://api.notion.com/v1/blocks/' + page_id + '/children?page_size=50', {
        headers: notionHeaders
      });
      const data = await res.json();
      if (data.object === 'error') {
        return { statusCode: 200, body: JSON.stringify({ error: data.message }) };
      }
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, results: data.results })
      };
    }

    // ── DB에 항목 추가 (Social Media Board) ──
    if (action === 'add_to_db') {
      const { database_id, title, content, status } = payload;

      const res = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: notionHeaders,
        body: JSON.stringify({
          parent: { database_id: database_id },
          properties: {
            이름: {
              title: [{ text: { content: title || '제목 없음' } }]
            },
            상태: {
              select: { name: status || 'Draft' }
            }
          },
          children: splitContent(content)
        })
      });

      const data = await res.json();
      if (data.object === 'error') {
        return { statusCode: 200, body: JSON.stringify({ error: data.message }) };
      }
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, url: data.url, id: data.id })
      };
    }

    return { statusCode: 400, body: JSON.stringify({ error: '알 수 없는 action' }) };

  } catch (err) {
    return {
      statusCode: 200,
      body: JSON.stringify({ error: '서버 오류: ' + err.message })
    };
  }
};
