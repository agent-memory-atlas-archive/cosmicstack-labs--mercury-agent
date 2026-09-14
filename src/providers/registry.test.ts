import { describe, expect, it } from 'vitest';
import type { BaseProvider } from './base.js';
import { ProviderRegistry } from './registry.js';

function provider(name: string, model: string): BaseProvider {
  return {
    name,
    getModel: () => model,
  } as BaseProvider;
}

describe('ProviderRegistry live default', () => {
  it('switches the runtime default immediately and clears a previous fallback winner', () => {
    const registry = new (ProviderRegistry as any)('first') as ProviderRegistry;
    registry.set('first', provider('first', 'model-a'));
    registry.set('second', provider('second', 'model-b'));
    registry.markSuccess('first');

    registry.setDefault('second');

    expect(registry.getDefault().name).toBe('second');
    expect(registry.getDefault().getModel()).toBe('model-b');
  });
});

/**
 * Fallback order must respect the user's chosen default. Registration order
 * puts Mercury Cloud first in the map, so a failed attempt on a BYOK default
 * used to promote Mercury Cloud immediately — and markSuccess then stuck to
 * it for every following turn, silently overriding the doctor's choice.
 */
describe('ProviderRegistry fallback order', () => {
  function registryWithDefault(defaultName: string): ProviderRegistry {
    const registry = new (ProviderRegistry as any)(defaultName) as ProviderRegistry;
    // Registration order mirrors the real one: Mercury Cloud first.
    registry.set('mercuryCloud', provider('mercuryCloud', 'cloud-model'));
    registry.set('deepseek', provider('deepseek', 'deepseek-model'));
    registry.set('chatgptWeb', provider('chatgptWeb', 'gpt-web'));
    return registry;
  }

  const order = (registry: ProviderRegistry, preferred?: string): string[] => {
    const iterator = registry.getFallbackIterator(preferred);
    return [...iterator].map((p) => p.name);
  };

  it('puts Mercury Cloud LAST in the fallback chain when the default is a BYOK provider', () => {
    const registry = registryWithDefault('chatgptWeb');
    const names = order(registry);
    expect(names[0]).toBe('chatgptWeb');
    expect(names[names.length - 1]).toBe('mercuryCloud');
    expect(names).toContain('deepseek');
  });

  it('keeps Mercury Cloud first when it IS the chosen default', () => {
    const registry = registryWithDefault('mercuryCloud');
    expect(order(registry)[0]).toBe('mercuryCloud');
  });

  it('respects an explicit preferred provider (channel override) the same way', () => {
    const registry = registryWithDefault('mercuryCloud');
    const names = order(registry, 'deepseek');
    expect(names[0]).toBe('deepseek');
    expect(names[names.length - 1]).toBe('mercuryCloud');
  });

  it('never drops or duplicates the default provider', () => {
    const registry = registryWithDefault('chatgptWeb');
    const names = order(registry);
    expect(names.filter((n) => n === 'chatgptWeb')).toHaveLength(1);
    expect(new Set(names).size).toBe(names.length);
  });
});
