// =============================================================================
// PATCH FOR: frontend/src/actions/initIO.js
// =============================================================================
// 
// ISSUE: The RTC_SET_COUNTERPART dispatch is commented out, causing "Unknown User"
//        to appear on incoming calls (phone-to-desktop).
//
// FIND THIS CODE (around line where "call" event is handled):
// -----------------------------------------------------------------------------

io.on("call", (data) => {
  console.log("call", data);
  /*
  store.dispatch({
    type: Actions.RTC_SET_COUNTERPART,
    counterpart: data.counterpart,
  });
  */
  store.dispatch({ type: Actions.RTC_CALL, data });
});

// -----------------------------------------------------------------------------
// REPLACE WITH:
// -----------------------------------------------------------------------------

io.on("call", (data) => {
  console.log("call", data);
  
  // ✅ FIX: Dispatch counterpart so Ringing component shows caller info
  if (data.counterpart) {
    store.dispatch({
      type: Actions.RTC_SET_COUNTERPART,
      counterpart: data.counterpart,
    });
  }
  
  store.dispatch({ type: Actions.RTC_CALL, data });
});

// =============================================================================
// END OF PATCH
// =============================================================================
