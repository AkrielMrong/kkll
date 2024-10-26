

// List of all commands available
const commands = {
  'chatInfo': async (bot, req, args) => await bot.getChatInfo(req, args),
  'ping': async (bot, req, args) => await bot.ping(req, args),
  'toss': async (bot, req, args) => await bot.toss(req, args)
  'downloadVideo': async (bot, req, args) => await bot.downloadVideo(req, args),
  'help': async (bot, req, args) => await bot.help(req, args)
}
}

// Configurations
const bot_configs = [{
    'bot_name': 'WhatAmIDoingNowBot',
    'token': ENV_WhatAmIDoingNowBot,
    'commands': {
      '/chatInfo': commands.chatInfo,
      '/ping': commands.ping
    }
  },
  {
    'bot_name': 'PingTest007Bot',
    'token': ENV_PingTest007Bot,
    'commands': {
      '/chatInfo': commands.chatInfo,
      '/ping': commands.ping
    }
  },
  {
    'bot_name': 'CareFree007Bot',
    'token': ENV_CareFree007Bot,
    'commands': {
      '/chatInfo': commands.chatInfo,
      '/ping': commands.ping,
      '/toss': commands.toss
    }
  }
]

const video_bot_config = {
    'bot_name': 'VideoDownloaderBot',
    'token': ENV_VideoDownloaderBot, // Add this to your environment variables
    'commands': {
        '/download': commands.downloadVideo,
        '/help': commands.help
    }
}


// Work in progress. Some bugs in logger exists.
const logger_config = {
  'enabled': true, // Enable/Disable logger
  'bot_name': 'BotLogger007Bot',
  'token': ENV_BotLogger007Bot,
  'chat_id': ENV_ADMIN_ID // Admin chat ID
}









// Extend the TelegramBot class with video downloading capabilities
class VideoDownloaderBot extends TelegramBot {
    constructor(config) {
        super(config);
        this.maxSize = 2000 * 1024 * 1024; // 2GB in bytes
        this.supportedDomains = ['youtube.com', 'vimeo.com', 'dailymotion.com']; // Add more as needed
    }

    // Help command
    async help(req, args) {
        const helpText = `
📥 *Video Downloader Bot Help*

Commands:
/download [URL] - Download video from supported URL
/help - Show this help message

Supported sites:
${this.supportedDomains.map(domain => `• ${domain}`).join('\n')}

Maximum file size: 2GB

Example:
/download https://example.com/video.mp4
`;
        await this.sendMessage(this.message.chat.id, helpText, 'Markdown');
    }

    // Main download command
    async downloadVideo(req, args) {
        if (!args || args.length === 0) {
            await this.sendMessage(this.message.chat.id, "Please provide a video URL.\nExample: /download https://example.com/video.mp4");
            return;
        }

        const url = args[0];
        
        // Validate URL
        if (!this.isValidUrl(url)) {
            await this.sendMessage(this.message.chat.id, "Please provide a valid URL");
            return;
        }

        // Check if domain is supported
        if (!this.isSupportedDomain(url)) {
            await this.sendMessage(
                this.message.chat.id, 
                `This domain is not supported. Supported domains are:\n${this.supportedDomains.join('\n')}`
            );
            return;
        }

        try {
            // Send initial status message
            const statusMsg = await this.sendMessage(
                this.message.chat.id, 
                "🔍 Analyzing video URL..."
            );

            // Get video metadata
            const metadata = await this.getVideoMetadata(url);
            
            // Check file size
            if (metadata.size > this.maxSize) {
                await this.sendMessage(
                    this.message.chat.id,
                    "❌ Video is too large. Maximum size is 2GB."
                );
                return;
            }

            // Update status
            await this.editMessage(
                this.message.chat.id,
                statusMsg.message_id,
                "⏬ Downloading video..."
            );

            // Download video
            const videoBuffer = await this.downloadVideoBuffer(url, async (progress) => {
                // Update progress every 10%
                if (progress % 10 === 0) {
                    await this.editMessage(
                        this.message.chat.id,
                        statusMsg.message_id,
                        `⏬ Downloading: ${progress}%`
                    );
                }
            });

            // Update status
            await this.editMessage(
                this.message.chat.id,
                statusMsg.message_id,
                "⏫ Uploading to Telegram..."
            );

            // Upload to Telegram
            await this.sendVideo(
                this.message.chat.id,
                videoBuffer,
                metadata.duration,
                metadata.width,
                metadata.height,
                '',
                metadata.title || 'Downloaded Video',
                'Markdown',
                true // Enable streaming
            );

            // Delete status message
            await this.deleteMessage(this.message.chat.id, statusMsg.message_id);

        } catch (error) {
            await this.sendMessage(
                this.message.chat.id,
                `❌ Error: ${error.message}`
            );
        }
    }

    // Validate URL format
    isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    // Check if domain is supported
    isSupportedDomain(url) {
        const domain = new URL(url).hostname;
        return this.supportedDomains.some(supported => domain.includes(supported));
    }

    // Get video metadata
    async getVideoMetadata(url) {
        const response = await fetch(url, { method: 'HEAD' });
        const size = parseInt(response.headers.get('content-length') || '0');
        
        // You would need to implement platform-specific metadata extraction
        // This is a simplified version
        return {
            size: size,
            duration: 0, // Would come from video metadata
            width: 1280, // Would come from video metadata
            height: 720, // Would come from video metadata
            title: 'Video' // Would come from video metadata
        };
    }

    // Download video with progress tracking
    async downloadVideoBuffer(url, progressCallback) {
        const response = await fetch(url);
        const reader = response.body.getReader();
        const contentLength = parseInt(response.headers.get('Content-Length') || '0');
        
        let receivedLength = 0;
        const chunks = [];

        while(true) {
            const {done, value} = await reader.read();
            
            if (done) break;
            
            chunks.push(value);
            receivedLength += value.length;
            
            const progress = Math.round((receivedLength / contentLength) * 100);
            await progressCallback(progress);
        }

        const videoBuffer = new Uint8Array(receivedLength);
        let position = 0;
        for(const chunk of chunks) {
            videoBuffer.set(chunk, position);
            position += chunk.length;
        }
        
        return videoBuffer;
    }

    // Edit message helper
    async editMessage(chatId, messageId, text, parse_mode = '') {
        const url = `${this.url}/editMessageText?chat_id=${chatId}&message_id=${messageId}&text=${encodeURIComponent(text)}`;
        if (parse_mode) url += `&parse_mode=${parse_mode}`;
        await fetch(url);
    }

    // Delete message helper
    async deleteMessage(chatId, messageId) {
        const url = `${this.url}/deleteMessage?chat_id=${chatId}&message_id=${messageId}`;
        await fetch(url);
    }
}

// Add this to your Handler class's handle method
if (this.bot_id > -1) {
    // Check if this is the video downloader bot
    if (this.configs[this.bot_id].bot_name === 'VideoDownloaderBot') {
        this.bot = new VideoDownloaderBot({
            'token': this.tokens[this.bot_id],
            'access_key': this.access_keys[this.bot_id],
            'commands': this.configs[this.bot_id].commands
        });
    } else {
        this.bot = new TelegramBot({
            'token': this.tokens[this.bot_id],
            'access_key': this.access_keys[this.bot_id],
            'commands': this.configs[this.bot_id].commands
        });
    }
    // ... rest of the handle method
}








class Webhook {
  constructor(url, token) {
    this.url = url
    this.token = token
  }

  // trigger getMe command of BotAPI
  async getMe() {
    return await this.execute(this.url + '/getMe')
  }

  async set() {
    const access_key = await sha256(this.token)
    return await this.execute(this.url + '/setWebhook?url=' + ENV_BOT_HOST_FQDN + access_key)
  }

  async get() {
    return await this.execute(this.url + '/getWebhookInfo')
  }

  async delete() {
    return await this.execute(this.url + '/deleteWebhook')
  }

  async execute(url) {
    const response = await fetch(url)
    const result = await response.json()
    return JSONResponse(result)
  }

  async process(url) {
    const command = url.searchParams.get('command')
    if (command == undefined) {
      return this.error("No command found", 404)
    }

    // handles the url commands
    switch (command) {
      case 'setWebhook':
        return await this.set()
      case 'getWebhook':
        return await this.get()
      case 'delWebhook':
        return await this.delete()
      case 'getMe':
        return await this.getMe()
      case '':
        return this.error("No command found", 404)
      default:
        return this.error("Invalid command", 400)

    }
  }

  // handles error responses
  error(message, status = 403) {
    return JSONResponse({
      error: message
    }, status)
  }

}





class BotModel {
  constructor(config) {
    this.token = config.token
    this.commands = config.commands
    this.url = 'https://api.telegram.org/bot' + config.token
    this.webhook = new Webhook(this.url, config.token)
  }

  // trigger sendAnimation command of BotAPI
  async update(request) {
    try {
      this.message = request.content.message
      if (this.message.hasOwnProperty('text')) {
        // process text

        // Test command and execute
        if (!(await this.executeCommand(request))) {
          // Test is not a command
          await this.sendMessage(this.message.chat.id, "This is not a command")
        }
      } else if (this.message.hasOwnProperty('photo')) {
        // process photo
        console.log(this.message.photo)
      } else if (this.message.hasOwnProperty('video')) {
        // process video
        console.log(this.message.video)
      } else if (this.message.hasOwnProperty('animation')) {
        // process animation
        console.log(this.message.animation)
      } else if (this.message.hasOwnProperty('locaiton')) {
        // process locaiton
        console.log(this.message.locaiton)
      } else if (this.message.hasOwnProperty('poll')) {
        // process poll
        console.log(this.message.poll)
      } else if (this.message.hasOwnProperty('contact')) {
        // process contact
        console.log(this.message.contact)
      } else if (this.message.hasOwnProperty('dice')) {
        // process dice
        console.log(this.message.dice)
      } else if (this.message.hasOwnProperty('sticker')) {
        // process sticker
        console.log(this.message.sticker)
      } else if (this.message.hasOwnProperty('reply_to_message')) {
        // process reply of a message
        console.log(this.message.reply_to_message)
      } else {
        // process unknown type
        console.log(this.message)
      }

      if (logger_config.enabled && !(this.message.hasOwnProperty('text'))) await this.sendMessage(this.message.chat.id, logJSONinHTML(this.message), 'HTML')

    } catch (error) {
      console.error(error)
      return JSONResponse(error.message)
    }
    // return 200 OK response to every update request
    return new Response('True', {
      status: 200
    })
  }

  // execute the custom bot commands from bot configurations
  async executeCommand(req) {
    let cmdArray = this.message.text.split(' ')
    const command = cmdArray.shift()
    const isCommand = Object.keys(this.commands).includes(command)
    if (isCommand) {
      await this.commands[command](this, req, cmdArray)
      return true
    }
    return false
  }

  // trigger sendMessage command of BotAPI
  async sendMessage(chat_id, text,
    parse_mode = '',
    disable_web_page_preview = false,
    disable_notification = false,
    reply_to_message_id = 0) {

    let url = this.url + '/sendMessage?chat_id=' + chat_id + '&text=' + text

    url = addURLOptions(url, {
      "parse_mode": parse_mode,
      "disable_web_page_preview": disable_web_page_preview,
      "disable_notification": disable_notification,
      "reply_to_message_id": reply_to_message_id
    })

    await fetch(url)
  }

  // trigger forwardMessage command of BotAPI
  async forwardMessage(chat_id, from_chat_id, disable_notification = false, message_id) {

    let url = this.url + '/sendMessage?chat_id=' + chat_id +
      '&from_chat_id=' + from_chat_id +
      '&message_id=' + message_id
    if (disable_notification) url += '&disable_notification=' + disable_notification

    url = addURLOptions(url, {
      "disable_notification": disable_notification
    })

    await fetch(url)
  }

  // trigger sendPhoto command of BotAPI
  async sendPhoto(chat_id, photo,
    caption = '',
    parse_mode = '',
    disable_notification = false,
    reply_to_message_id = 0) {

    let url = this.url + '/sendPhoto?chat_id=' + chat_id + '&photo=' + photo

    url = addURLOptions(url, {
      "caption": caption,
      "parse_mode": parse_mode,
      "disable_notification": disable_notification,
      "reply_to_message_id": reply_to_message_id
    })

    await fetch(url)
  }

  // trigger sendVideo command of BotAPI
  async sendVideo(chat_id, video,
    duration = 0,
    width = 0,
    height = 0,
    thumb = '',
    caption = '',
    parse_mode = '',
    supports_streaming = false,
    disable_notification = false,
    reply_to_message_id = 0) {

    let url = this.url + '/sendVideo?chat_id=' + chat_id + '&video=' + video

    url = addURLOptions(url, {
      "duration": duration,
      "width": width,
      "height": height,
      "thumb": thumb,
      "caption": caption,
      "parse_mode": parse_mode,
      "supports_streaming": supports_streaming,
      "disable_notification": disable_notification,
      "reply_to_message_id": reply_to_message_id
    })

    await fetch(url)
  }

  // trigger sendAnimation command of BotAPI
  async sendAnimation(chat_id, animation,
    duration = 0,
    width = 0,
    height = 0,
    thumb = '',
    caption = '',
    parse_mode = '',
    disable_notification = false,
    reply_to_message_id = 0) {

    let url = this.url + '/sendAnimation?chat_id=' + chat_id + '&animation=' + animation

    url = addURLOptions(url, {
      "duration": duration,
      "width": width,
      "height": height,
      "thumb": thumb,
      "caption": caption,
      "parse_mode": parse_mode,
      "disable_notification": disable_notification,
      "reply_to_message_id": reply_to_message_id
    })

    await fetch(url)
  }

  // trigger sendLocation command of BotAPI
  async sendLocation(chat_id, latitude, longitude,
    live_period = 0,
    disable_notification = false,
    reply_to_message_id = 0) {

    let url = this.url + '/sendLocation?chat_id=' + chat_id + '&latitude=' + latitude + '&longitude=' + longitude

    url = addURLOptions(url, {
      "live_period": live_period,
      "disable_notification": disable_notification,
      "reply_to_message_id": reply_to_message_id
    })

    await fetch(url)
  }

  // trigger senPoll command of BotAPI
  async sendPoll(chat_id, question, options,
    is_anonymous = '', // Use 'false' to set it instead of Boolean false
    type = '',
    allows_multiple_answers = false,
    correct_option_id = 0,
    explanation = '',
    explanation_parse_mode = '',
    open_period = 0,
    close_date = 0,
    is_closed = false,
    disable_notification = false,
    reply_to_message_id = 0) {

    let url = this.url + '/sendPoll?chat_id=' + chat_id + '&question=' + question + '&options=' + options

    url = addURLOptions(url, {
      "is_anonymous": is_anonymous,
      "type": type,
      "allows_multiple_answers": allows_multiple_answers,
      "correct_option_id": correct_option_id,
      "explanation": explanation,
      "explanation_parse_mode": explanation_parse_mode,
      "open_period": open_period,
      "close_date": close_date,
      "is_closed": is_closed,
      "disable_notification": disable_notification,
      "reply_to_message_id": reply_to_message_id
    })

    await fetch(url)
  }

  // trigger senDice command of BotAPI
  async sendDice(chat_id,
    emoji = '',
    disable_notification = false,
    reply_to_message_id = 0) {

    let url = this.url + '/sendDice?chat_id=' + chat_id

    url = addURLOptions(url, {
      "emoji": emoji,
      "disable_notification": disable_notification,
      "reply_to_message_id": reply_to_message_id
    })

    await fetch(url)
  }

  // bot api command to get user profile photos
  async getUserProfilePhotos(user_id,
    offset = 0,
    limit = 0) {

    let url = this.url + '/getUserProfilePhotos?user_id=' + user_id

    url = addURLOptions(url, {
      "offset": offset,
      "limit": limit
    })

    const response = await fetch(url)
    const result = await response.json()
    return result.result.photos
  }
}





class TelegramBot extends BotModel {
  constructor(config) {
    super(config)
  }

  // bot command: /toss
  async toss(req, args) {
    const outcome = (Math.floor(Math.random() * 2) == 0) ? 'Heads' : 'Tails'
    await this.sendMessage(this.message.chat.id, outcome)
  }

  // bot command: /ping
  async ping(req, args) {
    const text = (args.length < 1) ? 'pong' : args.join(' ')
    await this.sendMessage(this.message.chat.id, text)
  }

  // bot command: /chatInfo
  async getChatInfo(req, args) {
    await this.sendMessage(
      this.message.chat.id,
      logJSONinHTML(this.message.chat),
      'HTML')
  }

  // Send all the profile pictures to user_id
  async sendAllProfilePhotos(chat_id, user_id) {
    const profilePhotos = await this.getUserProfilePhotos(user_id)
    for (const item of profilePhotos) {
      await this.sendPhoto(chat_id, item[0].file_id)
    }
  }
}





class Logger {
  constructor(config) {
    this.enabled = config.enabled
    this.chat_id = config.chat_id
    this.token = config.token
    this.url = 'https://api.telegram.org/bot' + config.token
    this.webhook = new Webhook(this.url, config.token)
  }

  async load() {
    if (this.enabled) this.access_key = await sha256(this.token)
  }

  async sendLog(req) {
    if (this.enabled) {
      const url = this.getURL(JSON.stringify({
        'client': req.headers.get('cf-connecting-ip'),
        'method': req.method,
        'type': req.type,
        'url': req.url,
        'body': req.content
      }, null, 2))
      await fetch(url)
    }
  }

  async debug(data) {
    if (this.enabled) {
      const text = ((typeof data) === "string") ? data : JSON.stringify(data, null, 2)
      const url = this.getURL(text)
      await fetch(url)
    }
  }

  getURL(text) {
    let url = this.url + '/sendMessage?chat_id=' + this.chat_id
    url = addURLOptions(url, {
      "text": preTagString(text),
      "parse_mode": 'HTML',
      "disable_web_page_preview": true,
      "disable_notification": true
    })
    return url
  }
}





class Handler {
  constructor(configs) {
    this.configs = configs
    this.tokens = this.configs.map((item) => item.token)
    if (logger_config.enabled) this.logger = new Logger(logger_config) // Optional
    this.response = new Response()
  }

  // handles the request
  async handle(request) {
    await this.logger.load()

    const url = new URL(request.url)
    const url_key = url.pathname.substring(1).replace(/\/$/, "")

    this.access_keys = await Promise.all(this.tokens.map(async (token) => await sha256(token)))
    this.bot_id = this.access_keys.indexOf(url_key)


    if (this.bot_id > -1) {
      this.request = await this.processRequest(request)

      this.bot = new TelegramBot({
        'token': this.tokens[this.bot_id], // Bot Token
        'access_key': this.access_keys[this.bot_id], // Access Key
        'commands': this.configs[this.bot_id].commands // Bot commands
      })

      if (this.request.method === 'POST' && this.request.type.includes('application/json') && this.request.size > 6 && this.request.content.message) this.response = await this.bot.update(this.request)
      else if (this.request.method === 'GET') this.response = await this.bot.webhook.process(url)
      else this.response = this.error(this.request.content.error)

    } else if (request.method === 'GET' && url_key === this.logger.access_key) {
      this.response = await this.logger.webhook.process(url)
    } else {
      this.response = this.error("Invalid access key")
    }

    // Log access keys to console if access key is not acceptable
    for( const id in this.access_keys) console.log(this.configs[id].bot_name,'Access Link -',ENV_BOT_HOST_FQDN+this.access_keys[id])
    console.log('Logger Bot Access Link: ' + ENV_BOT_HOST_FQDN+this.logger.access_key)
    await this.logger.sendLog(request)

    return this.response
  }

  async processRequest(req) {
    let request = req
    request.size = parseInt(request.headers.get('content-length')) || 0
    request.type = request.headers.get('content-type') || ''
    if (request.size && request.type) request.content = await this.getContent(request)
    else if (request.method == 'GET') request.content = {
      message: 'Accessing webhook'
    }
    else request.content = {
      message: '',
      error: 'Invalid content type or body'
    }
    console.log(req)
    return request
  }

  async getContent(request) {
    try {
      if (request.type.includes('application/json')) {
        return await request.json()
      } else if (request.type.includes('text/')) {
        return await request.text()
      } else if (request.type.includes('form')) {
        const formData = await request.formData()
        const body = {}
        for (const entry of formData.entries()) {
          body[entry[0]] = entry[1]
        }
        return body
      } else {
        const arrayBuff = await request.arrayBuffer()
        const objectURL = URL.createObjectURL(arrayBuff)
        return objectURL
      }
    } catch (error) {
      console.error(error.message)
      return {
        message: '',
        error: 'Invalid content/content type'
      }
    }
  }

  // handles error responses
  error(message, status = 403) {
    return JSONResponse({
      error: message
    }, status)
  }
}





// Initialize new request handler
const handler = new Handler(bot_configs)

// Listen to all fetch events received by worker
addEventListener('fetch', event => {
  event.respondWith(handler.handle(event.request))
})





// Generate JSON response
function JSONResponse(data, status = 200) {
  const init = {
    status: status,
    headers: {
      'content-type': 'application/json'
    }
  }
  return new Response(JSON.stringify(data, null, 2), init)
}

// SHA256 Hash function
async function sha256(message) {
  // encode as UTF-8
  const msgBuffer = new TextEncoder().encode(message)
  // hash the message
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  // convert ArrayBuffer to Array
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  // convert bytes to hex string
  const hashHex = hashArray.map(b => ('00' + b.toString(16)).slice(-2)).join('')
  return hashHex
}

// Stringify JSON and add <pre> tag HTML
function logJSONinHTML(data) {
  return preTagString(JSON.stringify(data, null, 2))
}

function preTagString(str) {
  return '<pre>' + str + '</pre>'
}

// Add options in URL
function addURLOptions(urlstr, options = {}) {
  let url = urlstr
  for (const key of Object.keys(options)) {
    if (options[key]) url += '&' + key + '=' + options[key]
  }
  return url
}