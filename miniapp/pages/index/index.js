var BASE_URL = 'https://werewolfgamejudge.pages.dev/'
var API_URL = 'https://api.werewolfjudge.eu.org'

Page({
  data: {
    url: '',
    splashBg: '/images/splash-bg.webp',
    networkHint: '',
    showRetry: false
  },

  onLoad(options) {
    var self = this

    wx.setKeepScreenOn({ keepScreenOn: true })

    // 确定目标页面 URL
    self._targetUrl = options.url ? decodeURIComponent(options.url) : BASE_URL

    // 网络状态变化 — 断网时阻止加载，恢复时自动加载
    wx.onNetworkStatusChange(function (res) {
      if (!res.isConnected) {
        self.setData({ networkHint: '当前无网络连接，请检查网络设置', showRetry: true })
      } else {
        self.setData({ networkHint: '', showRetry: false })
        // 网络恢复 + url 未设置 → 自动加载
        if (!self.data.url) {
          self._loadWebView(options.nonce)
        }
      }
    })

    // 初始网络检测 — 决定是否立即加载
    wx.getNetworkType({
      success: function (res) {
        if (res.networkType === 'none') {
          self.setData({ networkHint: '当前无网络连接，请检查网络设置', showRetry: true })
        } else {
          self._loadWebView(options.nonce)
        }
      },
      fail: function () {
        // 无法确认网络状态 → 直接尝试加载，让 web 端自己处理
        self._loadWebView(options.nonce)
      }
    })
  },

  /** 加载 web-view（仅在网络可用时调用） */
  _loadWebView(nonce) {
    var self = this
    var targetUrl = self._targetUrl

    if (nonce) {
      wx.login({
        success: function (res) {
          if (res.code) {
            wx.request({
              url: API_URL + '/auth/wechat-claim',
              method: 'POST',
              header: { 'Content-Type': 'application/json' },
              data: { code: res.code, nonce: nonce },
              success: function (resp) {
                if (resp.statusCode === 200) {
                  console.log('wechat-claim success')
                } else {
                  console.warn('wechat-claim failed:', resp.statusCode, resp.data)
                }
                self.setData({ url: targetUrl })
              },
              fail: function () {
                // claim 失败不阻止加载 — web 端有独立登录流程
                self.setData({ url: targetUrl })
              }
            })
          } else {
            self.setData({ url: targetUrl })
          }
        },
        fail: function () {
          self.setData({ url: targetUrl })
        }
      })
    } else {
      self.setData({ url: targetUrl })
    }
  },

  /** 重试：检查网络后重新加载 */
  onRetry() {
    var self = this
    self.setData({ networkHint: '', showRetry: false })
    wx.getNetworkType({
      success: function (res) {
        if (res.networkType === 'none') {
          self.setData({ networkHint: '当前无网络连接，请检查网络设置', showRetry: true })
        } else {
          // 有网络 — 加载或重加载
          var url = self.data.url || self._targetUrl
          self.setData({ url: '' })
          setTimeout(function () {
            self.setData({ url: url })
          }, 100)
        }
      }
    })
  },

  /** 切后台 — 关闭屏幕常亮，减少功耗 */
  onHide() {
    wx.setKeepScreenOn({ keepScreenOn: false })
  },

  /** 回前台 — 恢复屏幕常亮 */
  onShow() {
    wx.setKeepScreenOn({ keepScreenOn: true })
  },

  onMessage(_e) {
    // No-op — lastUrl restoration removed; share links use options.url
  },

  onError(e) {
    console.error('web-view load error:', e.detail)
    this.setData({
      url: '',
      networkHint: '页面加载失败，请检查网络后重试',
      showRetry: true
    })
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
      title: '狼人面杀电子裁判助手',
      path: '/pages/index/index'
    }
  },

  onShareTimeline() {
    return {
      title: '狼人面杀电子裁判助手',
      query: ''
    }
  },

  onAddToFavorites() {
    return {
      title: '狼人面杀电子裁判助手',
      query: ''
    }
  }
})
