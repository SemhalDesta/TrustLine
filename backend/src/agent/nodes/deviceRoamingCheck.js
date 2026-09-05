// backend/src/agent/nodes/deviceRoamingCheck.js
const { checkDeviceRoaming } = require("../../services/camaraClient");

/**
 * LangGraph node: deviceRoamingCheck
 * Reads: state.phoneNumber
 * Writes: state.signals.deviceRoaming, state.reasoningTrace
 *
 * Secondary/escalation-path signal — flags a number claiming to be a
 * local recruiter while the device is actually roaming internationally.
 */
async function deviceRoamingCheck(state) {
  const result = await checkDeviceRoaming(state.phoneNumber);

  if (!result.success) {
    return {
      signals: {
        deviceRoaming: { available: false, error: result.error },
      },
      reasoningTrace: [
        {
          step: "deviceRoamingCheck",
          detail: `Device Roaming check failed: ${JSON.stringify(result.error)}`,
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  // NOTE: field name unconfirmed — same caution as other nodes. Test
  // directly before trusting; likely "roaming" (boolean) based on
  // Device Reachability/Roaming naming conventions, but verify.
  const roaming = result.data.roaming === true;

  return {
    signals: {
      deviceRoaming: {
        available: true,
        roaming,
        raw: result.data,
      },
    },
    reasoningTrace: [
      {
        step: "deviceRoamingCheck",
        detail: roaming
          ? "Number is currently roaming internationally — inconsistent with a claimed local presence."
          : "Number is not roaming — consistent with a local presence.",
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

module.exports = { deviceRoamingCheck };