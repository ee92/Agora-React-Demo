import React from 'react'
import AgoraRTC from 'agora-rtc-sdk'
import styles from './styles.module.css'

import volume from './assets/volume-high.png'
import volumeOff from './assets/volume-off.png'

class Stream extends React.Component {

  constructor(props) {
    super(props)
    this.uid = this.props.stream && this.props.stream.streamId
    this.state = {
      muted: false,
      volume: 0,
    }
  }

  clearDefaultStyles = () => {
    let video = document.getElementById('video' + this.uid)
    if (!video) return
    video.style = ''
    video.removeAttribute("controls")
    let player = document.getElementById('player_' + this.uid)
    if (!player) return
    player.style = ''
  }

  getAudioLevel = () => {
    this.volumeInterval = setInterval(() => {
      let stream = this.props.stream
      if (!stream) return
      let volume = stream.getAudioLevel()
      this.setState({volume})
    }, 100)
  }

  disableSound = (e) => {
    e.stopPropagation()
    this.setState({muted: true})
    this.props.stream && this.props.stream.disableAudio()
  }

  enableSound = (e) => {
    e.stopPropagation()
    this.setState({muted: false})
    this.props.stream && this.props.stream.enableAudio()
  }

  handleClick = () => {
    this.props.click && this.props.click(this.uid)
  }

  componentDidMount() {
    let stream = this.props.stream
    if (!stream) return
    this.props.mount(stream)
    this.clearDefaultStyles()
    this.getAudioLevel()
  }

  componentWillUnmount() {
    this.volumeInterval && clearInterval(this.volumeInterval)
    let stream = this.props.stream
    if (!stream) return
    this.props.unmount(stream)
  }

  render() {
    return (
      <div>
        <section id={this.uid} className={styles.stream} onClick={this.handleClick}>
          <div className={styles.volume}>
            <div className={styles.volumeMeter}>
              <div className={styles.volumeBar} style={{height: (this.state.volume * 100) + '%'}}></div>
            </div>
            <button
              className={styles.muteButton}
              onClick={this.state.muted ? this.enableSound : this.disableSound}
            >
              <img src={this.state.muted ? volumeOff : volume} className={styles.icon}/>
            </button>
          </div>
        </section>
      </div>
    )
  }
}

class App extends React.Component {

  AgoraRTC = null
  client = null
  appid = null

  state = {
    playing: [],
    localStreams: [],
    streamList: [],
    mainStream: null,
  }

  initClient = () => {
    const appid = this.appid
    this.AgoraRTC = AgoraRTC
    this.AgoraRTC.Logger.setLogLevel(this.AgoraRTC.Logger.ERROR)
    const client = this.AgoraRTC.createClient({mode: "live", codec: "h264"})
    return new Promise((resolve, reject) => {
      client.init(appid, () => resolve(client))
    })
  }

  joinChannel = (client) => {
    let id = "test" // default channel name
    return new Promise((resolve, reject) => {
      client.join(null, id, null, uid => {
        this.setState({
          localStreams: [...this.state.localStreams, uid]
        }, () => resolve(uid))
      })
    })
  }

  createStream = (uid) => {
    let options = {
      streamID: uid,
      audio: true,
      video: true,
      screen: false
    }
    let stream = this.AgoraRTC.createStream(options)
    return new Promise(resolve => resolve(stream))
  }

  initStream = (stream) => {
    return new Promise((resolve, reject) => {
      stream.init(() => {
        this.addStream(stream)
        resolve(stream)
      })
    })
  }

  publishStream = (client, stream) => {
    if (client && stream) {
      client.publish(stream)
    }
  }

  subscribeStreams = (client) => {
    client.on('stream-added', (e) => {
      client.subscribe(e.stream)
    })
    client.on('stream-subscribed', (e) => {
      this.addStream(e.stream)
    })
    client.on('peer-leave', (e) => {
      this.removeStream(e.uid)
    })
    client.on('stream-removed', (e) => {
      this.removeStream(e.uid)
    })
  }

  addStream = (stream) => {
    let id = stream.streamId
    let repeat = this.state.streamList.some(item => {
      return item.streamId === id
    })
    if (repeat) return
    let main = !this.state.mainStream ? {mainStream: id} : {}
    this.setState({
      streamList: [...this.state.streamList, stream],
      ...main
    })
  }

  removeStream = (uid) => {
    this.state.streamList.forEach((item, index) => {
      if (item.streamId === uid) {
        item.close()
        let tempList = [...this.state.streamList]
        tempList.splice(index, 1)
        let newMain = tempList.length > 0
          ? {mainStream: tempList[0].streamId}
          : {mainStream: null}
        let main = this.state.mainStream === uid && newMain
        this.setState({
          streamList: tempList,
          ...main
        })
      }
    })
  }

  selectMain = (id) => {
    this.setState({mainStream: id})
  }

  start = async () => {
    let client = await this.initClient()
    this.subscribeStreams(client)
    let uid = await this.joinChannel(client)
    let stream = await this.createStream(uid)
    await this.initStream(stream)
    await this.publishStream(client, stream)
  }

  stop = () => {
    this.state.localStreams.forEach((stream) => {
      this.removeStream(stream)
    })
    this.client.leave()
  }

  mount = (stream) => {
    let id = stream.streamId
    if (!this.state.playing.includes(id)) {
      stream.play(`${id}`)
      this.setState({playing: [...this.state.playing, id]})
    }
  }

  unmount = (stream) => {
    let id = stream.streamId
    let exists = this.state.streamList.some(item => {
      return item.streamId === id
    })
    if (exists) return
    stream.stop()
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.state.mainStream !== prevState.mainStream
    || this.state.streamList !== prevState.streamList) {
      let thumbs = document.getElementById('ag-thumbs')
      let main = document.getElementById('ag-main')
      this.state.streamList.forEach((stream) => {
        let id = stream.streamId
        let div = document.getElementById(`${id}`)
        let mainStream = this.state.mainStream
        let parent = id === mainStream ? main : thumbs
        parent.appendChild(div)
      })
    }
  }

  componentWillMount() {
    this.appid = prompt('enter agora app id:')
    this.start()
  }

  componentWillUnmount() {
    this.stop()
  }

  render() {
    let { streamList } = this.state
    return (
      <div className={styles.root}>
        <div className={styles.grid} id="ag-grid"/>
        <div className={styles.thumbs} id="ag-thumbs"/>
        <div className={styles.main} id="ag-main"/>
        <div className={styles.hidden} id="ag-hidden">
          {streamList.map((stream) =>
            <Stream
              stream={stream}
              key={stream.streamId}
              click={this.selectMain}
              mount={this.mount}
              unmount={this.unmount}
            />
          )}
        </div>
      </div>
    )
  }
}

export default App
