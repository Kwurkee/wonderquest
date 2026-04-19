exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const body = JSON.parse(event.body);
    const provider = body.provider || 'claude';
    let responseText;

    if (provider === 'openai') {
      const openaiMessages = body.messages.map(msg => {
        if (Array.isArray(msg.content)) {
          const parts = msg.content.map(part => {
            if (part.type === 'image') {
              return {
                type: 'image_url',
                image_url: { url: `data:${part.source.media_type};base64,${part.source.data}` }
              };
            }
            return { type: 'text', text: part.text };
          });
          return { role: msg.role, content: parts };
        }
        return { role: msg.role, content: msg.content };
      });

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          max_tokens: 2000,
          messages: openaiMessages
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      responseText = data.choices[0].message.content;

    } else {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 2000,
          messages: body.messages
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      responseText = data.content[0].text;
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ text: responseText })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: { message: err.message } })
    };
  }
};
