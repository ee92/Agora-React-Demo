import React from 'react'
import AgoraRTC from 'agora-rtc-sdk'
import styles from './styles.module.css'

class Stream extends React.Component {

  constructor(props) {
    super(props)
    this.uid = this.props.stream && this.props.stream.streamId
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

  handleClick = () => {
    this.props.click && this.props.click(this.uid)
  }

  componentDidMount() {
    let stream = this.props.stream
    if (!stream) return
    console.log(`playing stream ${this.uid}`)
    stream.play(`${this.uid}`)
    // this.props.mount(stream)
    this.clearDefaultStyles()
  }

  componentWillUnmount() {
    let stream = this.props.stream
    if (!stream) return
    console.log(`stopping stream ${this.uid}`)
    stream.stop()
    // this.props.unmount(stream)
  }

  render() {
    return (
      <section id={this.uid} className={styles.stream} onClick={this.handleClick}/>
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
      streamList: [stream, ...this.state.streamList],
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

  // only call stream.play() if not already playing
  streamMount = (stream) => {
    let id = stream.streamId
    if (!this.state.playing.includes(id)) {
      stream.play(`${id}`)
      this.setState({playing: [...this.state.playing, id]})
    }
  }

  // only call stream.stop() if stream has been removed from streamList
  streamUnmount = (stream) => {
    let id = stream.streamId
    let exists = this.state.streamList.some(item => {
      return item.streamId === id
    })
    if (exists) return
    stream.stop()
  }

  componentWillMount() {
    this.appid = prompt("enter agora appid:")
    this.start()
  }

  componentWillUnmount() {
    this.stop()
  }

  render() {
    let { streamList, mainStream } = this.state
    return (
      <div className={styles.root}>
        <div className={styles.thumbs}>
          {streamList.map((stream) => {
            if (stream.streamId !== mainStream) {
              return (
                <Stream
                  stream={stream}
                  key={stream.streamId}
                  mount={this.streamMount}
                  unmount={this.streamUnmount}
                  click={this.selectMain}
                />
              )
            }
          })}
        </div>
        <div className={styles.main}>
          {streamList.map((stream) => {
            if (stream.streamId === mainStream) {
              return (
                <Stream
                  stream={stream}
                  key={stream.streamId}
                  mount={this.streamMount}
                  unmount={this.streamUnmount}
                />
              )
            }
          })}
        </div>
      </div>
    )
  }
}

export default App
