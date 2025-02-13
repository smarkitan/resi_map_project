"use client";

import * as React from "react";
import { Combobox as HeadlessCombobox } from "@headlessui/react";

export function Combobox({ options, value, onChange, placeholder }: { options: string[], value: string, onChange: (value: string) => void, placeholder: string }) {
  const [query, setQuery] = React.useState("");

  const filteredOptions = query === ""
    ? options
    : options.filter((option) =>
        option.toLowerCase().includes(query.toLowerCase())
      );

  return (
    <HeadlessCombobox value={value} onChange={onChange}>
      <div className="relative w-full">
        <HeadlessCombobox.Input
          className="w-full border rounded p-2"
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
        />
        <HeadlessCombobox.Options className="absolute w-full bg-white border rounded shadow-md max-h-40 overflow-auto">
          {filteredOptions.map((option) => (
            <HeadlessCombobox.Option key={option} value={option}>
              {({ active }) => (
                <div className={`p-2 ${active ? "bg-gray-200" : ""}`}>
                  {option}
                </div>
              )}
            </HeadlessCombobox.Option>
          ))}
        </HeadlessCombobox.Options>
      </div>
    </HeadlessCombobox>
  );
}
