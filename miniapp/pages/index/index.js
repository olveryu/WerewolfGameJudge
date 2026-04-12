var BASE_URL = 'https://werewolfjudge.eu.org/'

Page({
  data: {
    url: BASE_URL
  },

  onLoad(options) {
    var self = this

    // 1) 确定目标页面 URL — 分享链接走 options.url，否则一律首页
    var targetUrl = options.url ? decodeURIComponent(options.url) : BASE_URL

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
  }
})
