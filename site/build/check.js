import Ajv2020 from 'ajv/dist/2020.js';

const ID = 'eval-board:schema.json';

// Returns a function that throws, naming the file and the first schema error,
// on a run that doesn't fit `schema` (JSON Schema 2020-12, as Pydantic exports it).
//
// Ajv doesn't support the OpenAPI `discriminator.mapping` Pydantic writes for
// a union of flows, so a run is checked against the branch its tag maps to:
// its first error is then about its own flow, not about another flow's branch.
export function runChecker(schema) {
  // Formats (date-time, date) are not checked: that takes ajv-formats, and
  // Ajv is the site's one dependency.
  const ajv = new Ajv2020({ strict: false, validateFormats: false });
  ajv.addSchema({ ...schema, $id: ID, discriminator: undefined });
  const whole = ajv.getSchema(ID);
  const { propertyName, mapping = {} } = schema.discriminator ?? {};
  const branches = new Map(
    Object.entries(mapping).map(([tag, ref]) => [tag, ajv.getSchema(ID + ref)]),
  );

  return (file, run) => {
    const validate = branches.get(run?.[propertyName]) ?? whole;
    if (validate(run)) return;
    const [error] = validate.errors;
    const where = error.instancePath || '/';
    throw new Error(`${file} doesn't fit schema.json: ${where} ${error.message}`);
  };
}
