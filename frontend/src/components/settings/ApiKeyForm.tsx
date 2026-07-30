import { useState } from "react";

import { useCreateApiKey } from "../../api/settings";
import { Button } from "../ui/Button";
import { FieldGroup, Label, TextInput } from "../ui/Field";
import { Modal } from "../ui/Modal";
import { MaskedKeyInput } from "./MaskedKeyInput";

export function ApiKeyForm({ provider, onClose }: { provider: "gemini" | "groq" | "tavily"; onClose: () => void }) {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const create = useCreateApiKey();

  return (
    <Modal title={`Add ${provider} key`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({ provider, name, key }, { onSuccess: onClose });
        }}
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        <FieldGroup>
          <Label>Friendly name</Label>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Primary key" required />
        </FieldGroup>
        <FieldGroup>
          <Label>API key</Label>
          <MaskedKeyInput value={key} onChange={setKey} placeholder="Paste the key" />
        </FieldGroup>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending} disabled={!name || !key}>
            Add key
          </Button>
        </div>
      </form>
    </Modal>
  );
}
