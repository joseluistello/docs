# Provider activation checklist

A provider may move from `conditioned` to `approved` only when every required
item has evidence.

## Required evidence

- exact product function;
- input and output data classes;
- DPA or equivalent contractual terms;
- subprocessor list and processing regions;
- secondary-use and model-training terms;
- display/export/contact rights;
- retention and deletion behavior;
- opt-out and suppression support;
- incident notice process;
- pricing/credit semantics;
- test fixtures for provenance and deletion;
- policy version recorded in the provider register.

## Provider-specific questions

### Apollo, Hunter, and Tomba

- Is the returned field licensed for Brein display, export, and contact use?
- Can source and provider attribution be retained?
- What happens when a person requests removal?
- Can records be deleted or suppressed from future results?
- Are API, OAuth, reseller, and OEM terms materially different?

### Nylas

- Are Gmail/Outlook scopes limited to the send-only beta purpose?
- Does Nylas require or expose broader technical permissions than Brein uses?
- Is sending authorized by the workspace and the customer?
- Can the sender grant be revoked and deleted?
- Can campaign recipients and content be deleted from Nylas?
- Does the beta avoid inbox read/list/search and reply management entirely?
- Are tracking pixels or click tracking enabled and disclosed?

### Google

- Is the scope the minimum necessary?
- Is the feature covered by Google User Data Limited Use requirements?
- Are tokens encrypted and revocable?
- Is private Google data isolated from shared commercial data?
