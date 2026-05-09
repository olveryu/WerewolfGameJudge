// 国内微信用 pages.dev（已配置业务域名白名单，无 ICP 拦截）。
// 国际版 WeChat 用自定义域名（避免 pages.dev 被安全确认页吞掉 query params）。
var BASE_URL_CN = 'https://werewolfgamejudge.pages.dev/'
var BASE_URL_INTL = 'https://werewolfjudge.eu.org/'

function getBaseUrl() {
  try {
    var lang = wx.getSystemInfoSync().language || ''
    // zh_CN = 简体中文（国内微信），其他语言 = 国际版 WeChat
    return lang === 'zh_CN' ? BASE_URL_CN : BASE_URL_INTL
  } catch (e) {
    return BASE_URL_CN
  }
}

Page({
  data: {
    url: BASE_URL_CN
  },

  onLoad(options) {
    var self = this
    var baseUrl = getBaseUrl()

    wx.setKeepScreenOn({ keepScreenOn: true })

    // 1) 确定目标页面 URL — 分享链接走 options.url，否则按语言选首页
    //    分享链接域名可能来自不同环境，统一替换为当前用户应该用的域名
    var targetUrl = options.url ? decodeURIComponent(options.url) : baseUrl
    if (options.url) {
      targetUrl = targetUrl
        .replace('https://werewolfgamejudge.pages.dev/', baseUrl)
        .replace('https://werewolfjudge.eu.org/', baseUrl)
    }

    // 2) wx.login 获取 code，拼入 URL 让 web 端自动登录
    wx.login({
      success: function (res) {
        if (res.code) {
          var sep = targetUrl.indexOf('?') === -1 ? '?' : '&'
          self.setData({ url: targetUrl + sep + 'wxcode=' + res.code })
        } else {
          console.warn('wx.login failed:', res.errMsg)
          self.setData({ url: targetUrl })
        }
      },
      fail: function () {
        self.setData({ url: targetUrl })
      }
    })
  },

  onMessage(_e) {
    // No-op — lastUrl restoration removed; share links use options.url
  },

  onError(e) {
    console.error('web-view load error:', e.detail)
  },

  onShareAppMessage(options) {
    var webViewUrl = options.webViewUrl || ''
    var match = webViewUrl.match(/\/room\/([A-Za-z0-9]+)/)
    if (match) {
      return {
        title: '来一起玩狼人杀！房间 ' + match[1],
        path: '/pages/index/index?url=' + encodeURIComponent(webViewUrl)
      }
    }
    return {
      title: '狼人杀自助电子法官',
      path: '/pages/index/index'
    }
  },

  onShareTimeline() {
    return {
      title: '狼人杀自助电子法官',
      query: ''
    }
  },

  onAddToFavorites() {
    return {
      title: '狼人杀自助电子法官',
      query: ''
    }
  }
})
