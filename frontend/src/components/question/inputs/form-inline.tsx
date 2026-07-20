import { getDefaultQuestionValue, type ParsedFormQuestion } from "@tokenring-ai/agent/question";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { sendInteractionResponse } from "../sendInteractionResponse.ts";
import FileInlineQuestion from "./file-inline.tsx";
import TreeInlineQuestion from "./tree-inline.tsx";

interface FormInlineProps {
  agentId: string;
  question: ParsedFormQuestion;
  requestId: string;
  interactionId: string;
  onClose: () => void;
  autoFocus?: boolean;
}

export default function FormInlineQuestion({ agentId, question, requestId, interactionId, onClose, autoFocus = true }: FormInlineProps) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [currentSection, setCurrentSection] = useState(0);
  const [currentField, setCurrentField] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInvalid, setIsInvalid] = useState(false);
  const [showErrorAnimation, setShowErrorAnimation] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const section = question.sections[currentSection];
  const fieldEntries = section ? Object.entries(section.fields) : [];
  const currentEntry = fieldEntries[currentField];
  const totalFields = fieldEntries.length;
  const isLastField = currentField === totalFields - 1;
  const isLastSection = currentSection === question.sections.length - 1;

  // Auto-focus on mount and field changes
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    // Focus on input field when it's a text field
    if (currentEntry?.[1].type === "text" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentEntry]);

  const handleFieldSubmit = async (value: unknown) => {
    if (!section || !currentEntry) return;
    const [fieldKey, field] = currentEntry;
    // Validate required fields
    if (field.type === "text" && field.required && !value) {
      setIsInvalid(true);
      setShowErrorAnimation(true);
      inputRef.current?.focus();
      // Reset animation after it completes
      setTimeout(() => setShowErrorAnimation(false), 500);
      return;
    }

    setIsInvalid(false);
    setValues(prev => ({ ...prev, [`${section.name}.${fieldKey}`]: value }));

    if (isLastField && isLastSection) {
      // Build final result
      const result: Record<string, Record<string, unknown>> = {};
      for (const sec of question.sections) {
        const secResult: Record<string, unknown> = {};
        for (const key of Object.keys(sec.fields)) {
          secResult[key] = values[`${sec.name}.${key}`];
        }
        result[sec.name] = secResult;
      }
      const finalSection = (result[section.name] ??= {});
      finalSection[fieldKey] = value;

      setIsSubmitting(true);
      await sendInteractionResponse({
        agentId,
        requestId,
        interactionId,
        result,
      });
      onClose();
    } else if (isLastField) {
      setCurrentSection(currentSection + 1);
      setCurrentField(0);
    } else {
      setCurrentField(currentField + 1);
    }
  };

  const handlePrevious = () => {
    if (currentField > 0) {
      setCurrentField(currentField - 1);
    } else if (currentSection > 0) {
      const prevSection = question.sections[currentSection - 1];
      setCurrentSection(currentSection - 1);
      setCurrentField(prevSection ? Object.keys(prevSection.fields).length - 1 : 0);
    }
  };

  const handleCancel = async () => {
    await sendInteractionResponse({
      agentId,
      requestId,
      interactionId,
      result: getDefaultQuestionValue(question),
    });
    onClose();
  };

  // Reset validation state when field changes
  useEffect(() => {
    setIsInvalid(false);
    setShowErrorAnimation(false);
  }, []);

  if (!section || !currentEntry) {
    return null;
  }
  const [fieldKey, field] = currentEntry;

  const canGoPrevious = currentSection > 0 || currentField > 0;
  const currentFieldValue = values[`${section.name}.${fieldKey}`];

  return (
    <div ref={containerRef} className="p-4 space-y-3">
      {/* Progress indicator */}
      <div className="flex items-center justify-between text-2xs" aria-live="polite">
        <div className="flex items-center gap-2">
          <span className="text-muted">
            Section {currentSection + 1} of {question.sections.length}
          </span>
          <span className="text-muted">·</span>
          <span className="text-muted">
            Field {currentField + 1} of {totalFields}
          </span>
        </div>
        <span className="text-accent font-medium">{section.name}</span>
      </div>

      {/* Description */}
      {section.description && <p className="text-2xs text-muted italic">{section.description}</p>}

      {/* Field content */}
      <div className="min-h-37.5 flex flex-col">
        {field.type === "text" && (
          <div className="flex-1 flex flex-col gap-2">
            <label className="block text-sm text-primary" htmlFor={`form-field-${fieldKey}`}>
              {field.label}
              {field.required && <span className="text-error ml-1">*</span>}
            </label>
            {field.description && <p className="text-2xs text-muted">{field.description}</p>}
            {isInvalid && (
              <p className="text-2xs text-error flex items-center gap-1" role="alert">
                <span>This field is required</span>
              </p>
            )}
            <input
              ref={inputRef}
              id={`form-field-${fieldKey}`}
              type={field.masked ? "password" : "text"}
              defaultValue={typeof currentFieldValue === "string" ? currentFieldValue : field.defaultValue}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleFieldSubmit(e.currentTarget.value);
                } else if (e.key === "Escape") {
                  void handleCancel();
                }
              }}
              className={`w-full bg-primary border border-primary rounded-md text-primary text-sm p-2 outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/20 ${
                isInvalid ? "border-error" : ""
              } ${showErrorAnimation ? "animate-shake" : ""}`}
              aria-required={field.required}
              aria-invalid={isInvalid}
            />
          </div>
        )}

        {field.type === "treeSelect" && (
          <div className="flex-1 flex flex-col gap-2 min-h-37.5">
            <label className="block text-sm text-primary">{field.label}</label>
            <div className="border border-primary/30 rounded-lg flex-1 flex flex-col overflow-hidden">
              <TreeInlineQuestion
                question={field}
                agentId={agentId}
                requestId={requestId}
                onSubmitValue={handleFieldSubmit}
                onClose={() => {}}
                autoFocus={autoFocus}
              />
            </div>
          </div>
        )}

        {field.type === "fileSelect" && (
          <div className="flex-1 flex flex-col gap-2 min-h-37.5">
            <label className="block text-sm text-primary">{field.label}</label>
            {field.description && <p className="text-2xs text-muted">{field.description}</p>}
            <div className="border border-primary/30 rounded-lg flex-1 flex flex-col overflow-hidden">
              <FileInlineQuestion
                question={field}
                agentId={agentId}
                requestId={requestId}
                onSubmitValue={handleFieldSubmit}
                onClose={() => {}}
                autoFocus={autoFocus}
              />
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 p-1.5 rounded-md text-xs text-muted hover:text-primary transition-colors disabled:opacity-50 focus-ring"
          >
            <X className="w-3.5 h-3.5" />
            Cancel
          </button>
          {canGoPrevious && (
            <button
              type="button"
              onClick={handlePrevious}
              disabled={isSubmitting}
              className="flex items-center gap-1.5 text-xs text-primary hover:text-accent transition-colors disabled:opacity-50 bg-tertiary px-3 py-1.5 rounded-md focus-ring"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Previous
            </button>
          )}
        </div>
        {field.type === "text" && (
          <button
            type="button"
            onClick={e => {
              const input = e.currentTarget.parentElement?.parentElement?.querySelector("input") as HTMLInputElement;
              if (input.value) void handleFieldSubmit(input.value);
            }}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 bg-accent hover:bg-accent/90 text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
          >
            {isSubmitting ? (
              <>
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{isLastField && isLastSection ? "Submitting..." : "Processing..."}</span>
              </>
            ) : (
              <>
                {isLastField && isLastSection ? "Submit" : "Next"}
                <ChevronRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
