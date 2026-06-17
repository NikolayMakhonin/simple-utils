import type { Page } from 'playwright'

export type TNameValue = { [key: string]: string }

export type TStyle = {
  _: TNameValue
  before: TNameValue
  after: TNameValue
}

export type TElement = {
  tag: string
  selector: string
  classes: string[] | null | undefined
  attrs: TNameValue | null | undefined
  style: TStyle | null | undefined
  childs: TElement[] | null | undefined
}

export type TGetAllElementsFilters = {
  excludeAttrs?: null | string[]
  /** Fix attribute values by replacing matching patterns; useful for removing generated hashes */
  fixAttrs?: null | TFixPattern[]
  /** Fix style values by replacing matching patterns in CSS property values */
  fixStyles?: null | TFixPattern[]
  /** Exclude matching classes from the `classes` array */
  excludeClasses?: null | RegExp
  /** Exclude matching id from comparison data */
  excludeIds?: null | RegExp
  /** Exclude matching classes from displayed `selector` in diffs */
  excludeSelectorClasses?: null | RegExp
  /** Exclude matching id  from displayed `selector` in diffs */
  excludeSelectorIds?: null | RegExp
  /** Fix tag values by replacing matching patterns */
  fixTags?: null | TReplacePattern[]
  excludeStyles?: null | string[]
  excludeSelectors?: null | string[]
}

export type TPseudoStateConfig = {
  states: string[]
  delay?: null | number
}

export type TReplacePattern = { search: RegExp; replace: string }

export type TFixPattern = TReplacePattern & { name: RegExp }

export type TGetAllElementsArgs = {
  defaultStyle?: null | TStyle
  shouldEqualResult?: null | TElement
  filters?: null | TGetAllElementsFilters
}

export type PagesElementsChangesHandlePage = (args: {
  page: Page
  testId: string
  url: URL
  stateId: string
  filters?: null | TGetAllElementsFilters
}) => Promise<void>

export type PagesElementsChangesTest = {
  init(page: Page): Promise<void>
  handlePage: PagesElementsChangesHandlePage
  end({ checkExistUrlsOnly }: { checkExistUrlsOnly: boolean }): Promise<{
    [testId: string]: {
      [url: string]: {
        [stateId: string]: TElement
      }
    }
  }>
}
