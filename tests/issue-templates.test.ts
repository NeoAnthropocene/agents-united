import { describe, it, expect } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import YAML from 'yaml';

describe('GitHub Issue Templates & PR Configuration', () => {
  const templateDir = path.resolve(process.cwd(), '.github/ISSUE_TEMPLATE');
  const prTemplatePath = path.resolve(process.cwd(), '.github/PULL_REQUEST_TEMPLATE.md');

  it('contains config.yml with blank issues disabled and documentation links', () => {
    const configPath = path.join(templateDir, 'config.yml');
    expect(fs.existsSync(configPath)).toBe(true);

    const config = YAML.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config.blank_issues_enabled).toBe(false);
    expect(Array.isArray(config.contact_links)).toBe(true);
    expect(config.contact_links.length).toBeGreaterThanOrEqual(3);

    for (const link of config.contact_links) {
      expect(link.name).toBeDefined();
      expect(link.url).toBeDefined();
      expect(link.about).toBeDefined();
    }
  });

  const expectedTemplates = [
    '1_bug_report.yml',
    '2_feature_request.yml',
    '3_agent_proposal.yml',
    '4_skill_proposal.yml',
    '5_workflow_proposal.yml',
    '6_bundle_proposal.yml',
  ];

  it.each(expectedTemplates)('validates schema compliance for %s', (filename) => {
    const filePath = path.join(templateDir, filename);
    expect(fs.existsSync(filePath), `Template ${filename} should exist`).toBe(true);

    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = YAML.parse(content);

    expect(parsed.name).toBeTypeOf('string');
    expect(parsed.description).toBeTypeOf('string');
    expect(Array.isArray(parsed.body)).toBe(true);
    expect(parsed.body.length).toBeGreaterThanOrEqual(5);

    const allowedTypes = ['markdown', 'input', 'textarea', 'dropdown', 'checkboxes'];

    for (const item of parsed.body) {
      expect(allowedTypes).toContain(item.type);
      expect(item.attributes).toBeTypeOf('object');

      if (item.validations) {
        expect(item.validations).toBeTypeOf('object');
        if ('required' in item.validations) {
          expect(item.validations.required).toBeTypeOf('boolean');
        }
      }

      if (item.type === 'dropdown') {
        expect(Array.isArray(item.attributes.options)).toBe(true);
        expect(item.attributes.options.length).toBeGreaterThan(0);
      }

      if (item.type === 'checkboxes') {
        expect(Array.isArray(item.attributes.options)).toBe(true);
        expect(item.attributes.options.length).toBeGreaterThan(0);
        for (const opt of item.attributes.options) {
          expect(opt.label).toBeTypeOf('string');
        }
      }
    }
  });

  it('validates 4_skill_proposal.yml enforces the 7 mandatory sections', () => {
    const filePath = path.join(templateDir, '4_skill_proposal.yml');
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = YAML.parse(content);

    const mandatoryCheck = parsed.body.find((item: any) => item.id === 'mandatory_sections_check');
    expect(mandatoryCheck).toBeDefined();
    expect(mandatoryCheck.type).toBe('checkboxes');

    const labels = mandatoryCheck.attributes.options.map((opt: any) => opt.label);
    expect(labels.some((l: string) => l.includes('1. Overview & Purpose'))).toBe(true);
    expect(labels.some((l: string) => l.includes('2. Execution Triggers'))).toBe(true);
    expect(labels.some((l: string) => l.includes('3. Input/Output Requirements'))).toBe(true);
    expect(labels.some((l: string) => l.includes('4. Step-by-Step Runbook'))).toBe(true);
    expect(labels.some((l: string) => l.includes('5. Code & Config Exemplars'))).toBe(true);
    expect(labels.some((l: string) => l.includes('6. Edge Cases & Error Recovery'))).toBe(true);
    expect(labels.some((l: string) => l.includes('7. Verification Checklist'))).toBe(true);
  });

  it('validates 6_bundle_proposal.yml includes ADR 0014 / ADR 0015 planning loop modes', () => {
    const filePath = path.join(templateDir, '6_bundle_proposal.yml');
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = YAML.parse(content);

    const planningMode = parsed.body.find((item: any) => item.id === 'planning_loop_mode');
    expect(planningMode).toBeDefined();
    expect(planningMode.type).toBe('dropdown');

    const options = planningMode.attributes.options;
    expect(options.some((opt: string) => opt.includes('planner-orchestrator'))).toBe(true);
    expect(options.some((opt: string) => opt.includes('subagent-first'))).toBe(true);
  });

  it('contains pull request template (.github/PULL_REQUEST_TEMPLATE.md) targeting dev', () => {
    expect(fs.existsSync(prTemplatePath)).toBe(true);
    const content = fs.readFileSync(prTemplatePath, 'utf-8');
    expect(content).toContain('Base branch is `dev`');
    expect(content).toContain('Conventional Commits');
    expect(content).toContain('TDD Followed');
    expect(content).toContain('npm run typecheck');
  });
});
