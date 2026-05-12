var BASE_URL = 'https://werewolfgamejudge.pages.dev/'

Page({
  data: {
    url: BASE_URL
  },

  onLoad(options) {
    var self = this

    wx.setKeepScreenOn({ keepScreenOn: true })

    // 1) 确定目标页面 URL — 分享链接走 options.url，否则一律首页
    var targetUrl = options.url ? decodeURIComponent(options.url) : BASE_URL

    // 2) wx.login 获取 code，放入 path segment 让 web 端自动登录
    //    安全确认页会 strip query params 和 hash，但必须保留 path
    wx.login({
      success: function (res) {
        if (res.code) {
          var originEnd = targetUrl.indexOf('/', targetUrl.indexOf('//') + 2)
          if (originEnd === -1) originEnd = targetUrl.length
          var origin = targetUrl.substring(0, originEnd)
          var path = targetUrl.substring(originEnd) || '/'
          self.setData({ url: origin + '/wx-auth/' + res.code + path })
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
