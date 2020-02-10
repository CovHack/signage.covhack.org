import React, { useState, useEffect, useRef } from 'react';
import Countdown, { zeroPad } from "react-countdown";
import ReactFullpage from '@fullpage/react-fullpage';
import { useWindowSize } from 'react-use'
import Confetti from 'react-confetti'
import firebase from './firebase'
import { createStore, combineReducers } from 'redux'
import { Provider, useSelector } from 'react-redux'
import { useFirestoreConnect, ReactReduxFirebaseProvider, firebaseReducer } from 'react-redux-firebase'
import { createFirestoreInstance, firestoreReducer } from 'redux-firestore'


import './App.css';

const rootReducer = combineReducers({
  firebase: firebaseReducer,
  firestore: firestoreReducer // <- needed if using firestore
})

// Create store with reducers and initial state
const initialState = {}
const store = createStore(rootReducer, initialState)

const rrfProps = {
  firebase,
  config: {
    userProfile: 'users',
  },
  dispatch: store.dispatch,
  createFirestoreInstance
}

const Completionist = () => <span>Hacking has finished!</span>;

const renderer = (windowSize, message, { hours, minutes, seconds, completed }) => {
  if (completed) {
    return (<div>
      <Confetti
        width={windowSize.width}
        height={windowSize.height}
        recycle={false}
        numberOfPieces={2000}
      />
      <Completionist />
    </div>)
  } else {
    // Render a countdown
    return (
      <span>
        {message && <div>{message}<br /></div>}
        {zeroPad(hours, 2)}:{zeroPad(minutes, 2)}:{zeroPad(seconds, 2)}
      </span>
    );
  }
};


const useInterval = (callback, delay) => {
  const savedCallback = useRef();

  // Remember the latest callback.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval.
  useEffect(() => {
    function tick() {
      savedCallback.current();
    }
    if (delay !== null) {
      let id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}


const SliderHolder = (props) => {
  useInterval(() => {
    /* hack the make this auto scroll work, not needed if provided  */
    props.api.destroy()
    document.body.style['overflow'] = 'hidden'
    props.api.moveSectionDown()
  }, 1000*5);
  return <div>{props.slides}</div>
}

const SlideViewer = (slides, { state, fullpageApi }) => {
  return (
    <ReactFullpage.Wrapper>
      <SliderHolder api={fullpageApi} slides={slides} />
    </ReactFullpage.Wrapper>
  )

}

const Slides = (props) => {
  useFirestoreConnect('slides')
  const cloudSlides = useSelector(state => state.firestore.data.slides)
  let text = []

  if (cloudSlides) {
    for (let key of Object.keys(cloudSlides)) {
      text.push(cloudSlides[key])
    }
  }

  if (text.length === 0) {
    text.push({'content': '<p>Welcome to CovHack</p>'})
  }

  /* Filter to remove nulls */
  const preSlides = text.filter(item => item != null)

  /* extract the backgrounds so we can pass it to FullPage */
  const backgrounds = preSlides.map(
    item => item.background || '#00aeef'
  )

  const slides = (
      <div>
        {preSlides
          .map(
          item => (
            <div className="section" style={{ color: item.color || '#fff' }}>
              <div dangerouslySetInnerHTML={{ __html: item.content || '' }} />
            </div>
          ))}
      </div>
  )
  const SlideRenderer = (a) => SlideViewer(slides, a)

  return (
    <ReactFullpage
      licenseKey = {'YOUR_KEY_HERE'}
      scrollingSpeed = {1000}
      navigation = {true}
      loopBottom = {true}
      keyboardScrolling = { false }
      sectionsColor = {backgrounds}
      render = { SlideRenderer }
      scrollOverflowReset = { true }
    />
  )
}

const CountdownHeader = () => {
  useFirestoreConnect('config')
  const windowSize = useWindowSize()
  const config = useSelector(state => state.firestore.data.config)
  /* Default, just really far in the future. */
  let date = new Date('2999-12-31 12:00:00')
  let message = ''
  if (config && config.main && config.main.start_date && config.main.end_date) {
    /* check if hacking ends or starts sooner */
    const start_date = new Date(config.main.start_date)
    const end_date = new Date(config.main.end_date)
    if (end_date > Date.now() > start_date) {
      date = end_date
    } else {
      date = start_date
      message = 'Hacking starts in...'
    }

  }

  const countdownRenderer = (a) => renderer(windowSize, message, a)
  return (
    <ul id="menu">
      <li>
        <Countdown date={date} renderer={countdownRenderer} />
      </li>
    </ul>
  )
}

/* this needs to be rerendered every so often to remove stale notifications */
const Notifications = () => {
  let [count, setCount] = useState(0);

  /* Hack to trigger a rerender every second. */
  useInterval(
    () => {
      setCount(count + 1);
    }, 1000
  );
  useFirestoreConnect('notifications')

  const notifications = useSelector(state => state.firestore.data.notifications) || {}
  /* Display the 3 most recent */
  
  let temp = []
  for (let key of Object.keys(notifications)) {
    temp.push(notifications[key])
  }

  /* awful chain to get done nicely */
  const display = temp
    .filter((item) => item != null) // remove null items
    .sort(
      (item) => new Date(item.date)
    )
    .filter( // Remove all expired ones
      (item) =>  new Date(item.expire) > Date.now()
    )
    .slice(0, 3) // Only display 3
    .map( // map to a JSX list
      (item) =>
        <li>{item.content}</li>
    )
  return (
      <ul id="notifications">
        {display}
      </ul>
  )
}

const App = () => {
  return (
    <div className="App">
      <Provider store={store}>
        <ReactReduxFirebaseProvider {...rrfProps} >
          <CountdownHeader />
          <Slides />
          <Notifications />
        </ReactReduxFirebaseProvider>
      </Provider>,
    </div>
  );
}

export default App;
