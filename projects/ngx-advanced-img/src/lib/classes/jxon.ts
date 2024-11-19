/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable guard-for-in */
import { DOMImplementation, DOMParser, XMLSerializer, DocumentType } from '@xmldom/xmldom';
import { NgxAdvancedImgEmptyTree } from './empty-tree';

interface IXMLObj extends XMLDocument {
  xml?: string;
}

/**
 * A simple TypeScript port of jxon, a bi-directional lossless XML/JSON converter library. This has
 * been packaged in order to provide the latest security updates in accordance with the use of @xmldom/xmldom.
 */
export class NgxAdvancedImgJxon {

  private opts: any = {
    valueKey: '_',
    attrKey: '$',
    attrPrefix: '$',
    lowerCaseTags: false,
    trueIsEmpty: false,
    autoDate: false,
    ignorePrefixedNodes: false,
    parseValues: false
  };
  private aCache: HTMLElement[] = [];
  private rIsNull = /^\s*$/;
  private rIsBool = /^(?:true|false)$/i;
  private parser: DOMParser = new DOMParser();

  public config(cfg: any) {
    for (const k in cfg) {
      this.opts[k] = cfg[k];
    }
  }

  // build
  public xmlToJs(oXMLParent: any, nVerbosity?: number, bFreeze?: boolean, bNesteAttributes?: boolean): any {
    const _nVerb = arguments.length > 1 && typeof nVerbosity === 'number' ? nVerbosity & 3 : /* put here the default verbosity level: */ 1;
    return this.createObjTree(oXMLParent as Element, _nVerb, bFreeze || false, !!(arguments.length > 3 ? bNesteAttributes : _nVerb === 3));
  }

  // stringify
  public jsToString(oObjTree: any, sNamespaceURI?: string, sQualifiedName?: string, oDocumentType?: DocumentType) {
    return this.xmlToString(
      this.jsToXml(oObjTree, sNamespaceURI, sQualifiedName, oDocumentType)
    );
  }

  // unbuild
  public jsToXml(oObjTree: any, sNamespaceURI?: string, sQualifiedName?: string, oDocumentType?: DocumentType | null | undefined): XMLDocument {
    const documentImplementation: DOMImplementation = new DOMImplementation();
    const oNewDoc = documentImplementation.createDocument(
      sNamespaceURI || null,
      sQualifiedName || '',
      oDocumentType as DocumentType | null | undefined,
    ) as unknown as XMLDocument;
    this.loadObjTree(oNewDoc, oNewDoc.documentElement || oNewDoc, oObjTree);
    return oNewDoc;
  }

  public stringToXml(xmlStr: string): Document {
    if (!this.parser) {
      this.parser = new DOMParser();
    }

    return this.parser.parseFromString(xmlStr, 'application/xml') as unknown as Document;
  }

  public xmlToString(xmlObj: IXMLObj): string {
    if (typeof xmlObj.xml !== 'undefined') {
      return xmlObj.xml;
    } else {
      try {
        return (new XMLSerializer()).serializeToString(xmlObj as any);
      } catch (e) {
        try {
          return xmlObj.toString();
        } catch (e2) {
          throw new Error('Unable to serialize XML object');
        }
      }
    }
  }

  public stringToJs(str: string): any {
    const xmlObj: Document = this.stringToXml(str);
    return this.xmlToJs(xmlObj);
  }

  public parseText(sValue: string): string | boolean | number | Date | null {
    if (!this.opts.parseValues) {
      return sValue;
    }

    if (this.rIsNull.test(sValue)) {
      return null;
    }

    if (this.rIsBool.test(sValue)) {
      return sValue.toLowerCase() === 'true';
    }

    if (isFinite(+sValue)) {
      return parseFloat(sValue);
    }

    if (this.opts.autoDate && isFinite(Date.parse(sValue))) {
      return new Date(sValue);
    }

    return sValue;
  }

  public objectify(vValue: any): any {
    if (vValue === null) {
      return new NgxAdvancedImgEmptyTree();
    } else {
      if (vValue instanceof Object) {
        return vValue;
      } else {
        if (typeof vValue.constructor === 'function') {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          return new vValue.constructor(vValue);
        } else {
          return vValue;
        }
      }
    }
  }

  public createObjTree(oParentNode: Element, nVerb: number, bFreeze: boolean, bNesteAttr: boolean): any {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const CDATA = 4;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const TEXT = 3;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const ELEMENT = 1;
    const nLevelStart: number = this.aCache.length;
    const bChildren: boolean = oParentNode.hasChildNodes();
    const bAttributes: boolean = oParentNode.nodeType === oParentNode.ELEMENT_NODE && oParentNode.hasAttributes();
    const bHighVerb = Boolean(nVerb & 2);
    let nLength = 0;
    let sCollectedTxt = '';
    let vResult: any = bHighVerb ? {} : /* put here the default value for empty nodes: */ (this.opts.trueIsEmpty ? true : '');
    let sProp: string;
    let vContent: any;

    if (bChildren) {
      let oNode: Node;
      for (let nItem = 0; nItem < oParentNode.childNodes.length; nItem++) {
        oNode = oParentNode.childNodes.item(nItem);
        if (oNode.nodeType === CDATA) {
          sCollectedTxt += oNode.nodeValue;
        } /* nodeType is "CDATASection" (4) */
        else if (oNode.nodeType === TEXT) {
          sCollectedTxt += oNode.nodeValue?.trim();
        } /* nodeType is "Text" (3) */
        else if (oNode.nodeType === ELEMENT && !(this.opts.ignorePrefixedNodes && (oNode as HTMLElement).prefix)) {
          this.aCache.push(oNode as HTMLElement);
        }
        /* nodeType is "Element" (1) */
      }
    }

    const nLevelEnd = this.aCache.length;
    const vBuiltVal = this.parseText(sCollectedTxt);

    if (!bHighVerb && (bChildren || bAttributes)) {
      vResult = nVerb === 0 ? this.objectify(vBuiltVal) : {};
    }

    for (let nElId = nLevelStart; nElId < nLevelEnd; nElId++) {
      sProp = this.aCache[nElId].nodeName;
      if (this.opts.lowerCaseTags) {
        sProp = sProp.toLowerCase();
      }

      vContent = this.createObjTree(this.aCache[nElId], nVerb, bFreeze, bNesteAttr);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      if (vResult.hasOwnProperty(sProp)) {
        if (vResult[sProp].constructor !== Array) {
          vResult[sProp] = [vResult[sProp]];
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        vResult[sProp].push(vContent);
      } else {
        vResult[sProp] = vContent;

        nLength++;
      }
    }

    if (bAttributes) {
      const nAttrLen: number = oParentNode.attributes.length;
      const sAPrefix: string = bNesteAttr ? '' : this.opts.attrPrefix;
      const oAttrParent: any = bNesteAttr ? {} : vResult;
      let oAttrib: any;
      let oAttribName: string;

      for (let nAttrib = 0; nAttrib < nAttrLen; nLength++, nAttrib++) {
        oAttrib = oParentNode.attributes.item(nAttrib);

        oAttribName = oAttrib.name;
        if (this.opts.lowerCaseTags) {
          oAttribName = oAttribName.toLowerCase();
        }

        oAttrParent[sAPrefix + oAttribName] = this.parseText((oAttrib.value as string).trim());
      }

      if (bNesteAttr) {
        if (bFreeze) {
          Object.freeze(oAttrParent);
        }

        vResult[this.opts.attrKey] = oAttrParent;

        nLength -= nAttrLen - 1;
      }
    }

    if (nVerb === 3 || (nVerb === 2 || nVerb === 1 && nLength > 0) && sCollectedTxt) {
      vResult[this.opts.valueKey] = vBuiltVal;
    } else if (!bHighVerb && nLength === 0 && sCollectedTxt) {
      vResult = vBuiltVal;
    }
    if (bFreeze && (bHighVerb || nLength > 0)) {
      Object.freeze(vResult);
    }

    this.aCache.length = nLevelStart;

    return vResult;
  }

  public loadObjTree(oXMLDoc: XMLDocument, oParentEl: Element, oParentObj: any) {
    let vValue;
    let oChild: Element;
    let elementNS: string;

    if (oParentObj.constructor === String || oParentObj.constructor === Number || oParentObj.constructor === Boolean) {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      oParentEl.appendChild(oXMLDoc.createTextNode(oParentObj.toString())); /* verbosity level is 0 or 1 */
      if (oParentObj === oParentObj.valueOf()) {
        return;
      }

    } else if (oParentObj.constructor === Date) {
      oParentEl.appendChild(oXMLDoc.createTextNode(oParentObj.toISOString()));
    }
    for (const sName in oParentObj) {
      vValue = oParentObj[sName];
      if (vValue === undefined) {
        continue;
      }
      if (vValue === null) {
        vValue = {};
      }

      if (isFinite(+sName) || vValue instanceof Function) {
        continue;
      }

      /* verbosity level is 0 */
      if (sName === this.opts.valueKey) {
        if (vValue !== null && vValue !== true) {
          oParentEl.appendChild(oXMLDoc.createTextNode(vValue.constructor === Date ? vValue.toISOString() : String(vValue)));
        }

      } else if (sName === this.opts.attrKey) { /* verbosity level is 3 */
        for (const sAttrib in vValue) {
          oParentEl.setAttribute(sAttrib, `${vValue[sAttrib]}`);
        }
      } else if (sName === this.opts.attrPrefix + 'xmlns') {
        if (this.opts.isNodeJs) {
          oParentEl.setAttribute(sName.slice(1), `${vValue}`);
        }
        // do nothing: special handling of xml namespaces is done via createElementNS()
      } else if (sName.charAt(0) === this.opts.attrPrefix) {
        oParentEl.setAttribute(sName.slice(1), `${vValue}`);
      } else if (vValue.constructor === Array) {
        // eslint-disable-next-line @typescript-eslint/no-for-in-array
        for (const nItem in vValue) {
          if (!vValue.hasOwnProperty(nItem)) {
            continue;
          }
          elementNS = (vValue[nItem] && vValue[nItem][this.opts.attrPrefix + 'xmlns']) || oParentEl.namespaceURI;
          if (elementNS) {
            oChild = oXMLDoc.createElementNS(elementNS, sName);
          } else {
            oChild = oXMLDoc.createElement(sName);
          }

          this.loadObjTree(oXMLDoc, oChild, vValue[nItem] || {});
          oParentEl.appendChild(oChild);
        }
      } else {
        elementNS = (vValue || {})[this.opts.attrPrefix + 'xmlns'] || oParentEl.namespaceURI;
        if (elementNS) {
          oChild = oXMLDoc.createElementNS(elementNS, sName);
        } else {
          oChild = oXMLDoc.createElement(sName);
        }
        if (vValue instanceof Object) {
          this.loadObjTree(oXMLDoc, oChild, vValue);
        } else if (vValue !== null && (vValue !== true || !this.opts.trueIsEmpty)) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call
          oChild.appendChild(oXMLDoc.createTextNode(vValue.toString()));
        }
        oParentEl.appendChild(oChild);
      }
    }
  }

}
