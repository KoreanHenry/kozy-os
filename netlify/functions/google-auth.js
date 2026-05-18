exports.handler = async (event) => {
  const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  const REDIRECT_URI = 'https://heartfelt-crepe-fba0c0.netlify.app/auth/callback';

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch(e) {
    body = {};
  }

  const action = body.action || event.queryStringParameters?.action;

  // 1. OAuth 로그인 URL 생성
  if (action === 'get_auth_url') {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/calendar.readonly',
      access_type: 'offline',
      prompt: 'consent'
    });
    const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    };
  }

  // 2. 인증 코드로 토큰 교환
  if (action === 'exchange_code') {
    const { code } = body;
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code'
      })
    });
    const data = await res.json();
    if (data.error) {
      return { statusCode: 200, body: JSON.stringify({ error: data.error_description }) };
    }
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in
      })
    };
  }

  // 3. 토큰 갱신
  if (action === 'refresh_token') {
    const { refresh_token } = body;
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'refresh_token'
      })
    });
    const data = await res.json();
    if (data.error) {
      return { statusCode: 200, body: JSON.stringify({ error: data.error_description }) };
    }
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: data.access_token, expires_in: data.expires_in })
    };
  }

  // 4. 오늘 일정 가져오기
  if (action === 'get_today_events') {
    const { access_token } = body;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

    const params = new URLSearchParams({
      timeMin: startOfDay,
      timeMax: endOfDay,
      singleEvents: 'true',
      orderBy: 'startTime'
    });

    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?' + params, {
      headers: { Authorization: 'Bearer ' + access_token }
    });
    const data = await res.json();

    if (data.error) {
      return { statusCode: 200, body: JSON.stringify({ error: data.error.message }) };
    }

    const events = (data.items || []).map(function(e) {
      return {
        id: e.id,
        title: e.summary || '제목 없음',
        start: e.start.dateTime || e.start.date,
        end: e.end.dateTime || e.end.date,
        allDay: !e.start.dateTime,
        location: e.location || ''
      };
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events })
    };
  }

  // 5. 이번 주 일정 가져오기
  if (action === 'get_week_events') {
    const { access_token } = body;
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const params = new URLSearchParams({
      timeMin: monday.toISOString(),
      timeMax: sunday.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime'
    });

    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?' + params, {
      headers: { Authorization: 'Bearer ' + access_token }
    });
    const data = await res.json();

    if (data.error) {
      return { statusCode: 200, body: JSON.stringify({ error: data.error.message }) };
    }

    const events = (data.items || []).map(function(e) {
      return {
        id: e.id,
        title: e.summary || '제목 없음',
        start: e.start.dateTime || e.start.date,
        end: e.end.dateTime || e.end.date,
        allDay: !e.start.dateTime,
        location: e.location || ''
      };
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events })
    };
  }

  return { statusCode: 400, body: JSON.stringify({ error: '알 수 없는 action' }) };
};
